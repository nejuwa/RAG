import io
import os
import zipfile
from dataclasses import replace

os.environ["SECRET_KEY"] = "test-only-secret-key-that-is-at-least-32-bytes"
os.environ["DATABASE_URL"] = "sqlite:///./test-ria.db"
os.environ["RIA_ENV"] = "test"

import pytest
from fastapi import BackgroundTasks, HTTPException
from docx import Document

from app.auth import hash_password, verify_password
from app.citations import keep_cited_sentences
from app.chunking import TextBlock, chunk_blocks
from app.list_models import _generation_model_names
from app.parsing import parse_file, parse_html
from app.providers import GeminiProvider, ProviderError
from app.settings import _normalize_database_url, settings, validate_settings
from app.research_routes import _validate_upload_bytes
from app import storage
from app.jobs import enqueue_ingestion
from app.web_fetch import WebFetchError, validate_public_url


def test_chunking_keeps_page_and_heading_provenance() -> None:
    chunks = chunk_blocks(
        [
            TextBlock("Heading: Retrieval", page_number=2, section_path="Retrieval"),
            TextBlock("A relevant paragraph."),
        ],
        max_chars=64,
        overlap=8,
    )
    assert len(chunks) == 1
    assert chunks[0].page_number == 2
    assert chunks[0].section_path == "Retrieval"
    assert "A relevant paragraph." in chunks[0].text


def test_chunking_splits_long_paragraphs_and_overlaps() -> None:
    content = " ".join(f"term{i}" for i in range(50))
    chunks = chunk_blocks([TextBlock(content, page_number=4)], max_chars=50, overlap=10)
    assert len(chunks) > 1
    assert all(len(chunk.text) <= 50 for chunk in chunks)
    assert all(chunk.page_number == 4 for chunk in chunks)
    assert any(
        set(chunks[index].text.split()) & set(chunks[index + 1].text.split())
        for index in range(len(chunks) - 1)
    )


def test_password_hash_verifies_without_storing_plaintext() -> None:
    password = "correct horse battery staple"
    hashed = hash_password(password)
    assert password not in hashed
    assert verify_password(password, hashed)
    assert not verify_password("wrong password", hashed)


def test_local_application_configuration_requires_postgresql(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    local_settings = replace(
        settings,
        environment="local",
        database_url="sqlite:///./data/ria.db",
        secret_key="test-only-secret-key-that-is-at-least-32-bytes",
    )
    monkeypatch.setattr("app.settings.settings", local_settings)
    with pytest.raises(RuntimeError, match="DATABASE_URL must point to PostgreSQL"):
        validate_settings()


def test_inline_ingestion_schedules_source_without_redis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.jobs.settings",
        replace(settings, ingestion_mode="inline"),
    )
    scheduled = BackgroundTasks()

    enqueue_ingestion("source-1", scheduled)

    assert len(scheduled.tasks) == 1
    assert scheduled.tasks[0].func.__name__ == "process_source"
    assert scheduled.tasks[0].args == ("source-1",)


def test_inline_ingestion_requires_background_tasks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.jobs.settings",
        replace(settings, ingestion_mode="inline"),
    )
    with pytest.raises(
        RuntimeError, match="Inline ingestion requires FastAPI background tasks"
    ):
        enqueue_ingestion("source-1")


def test_queue_ingestion_still_enqueues_rq_job(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    enqueued: list[tuple[tuple[object, ...], dict[str, object]]] = []

    class FakeQueue:
        def __init__(self, name: str, *, connection: object) -> None:
            assert name == "ingestion"
            assert connection == "redis-connection"

        def enqueue(self, *args: object, **kwargs: object) -> None:
            enqueued.append((args, kwargs))

    monkeypatch.setattr(
        "app.jobs.settings",
        replace(settings, ingestion_mode="queue", redis_url="redis://test"),
    )
    monkeypatch.setattr(
        "app.jobs.Redis.from_url",
        lambda *_args, **_kwargs: "redis-connection",
    )
    monkeypatch.setattr("app.jobs.Queue", FakeQueue)

    enqueue_ingestion("source-queue")

    assert enqueued == [
        (
            ("app.ingestion.process_source", "source-queue"),
            {
                "job_timeout": 600,
                "result_ttl": 3600,
                "failure_ttl": 86400,
            },
        )
    ]


def test_application_configuration_rejects_unknown_ingestion_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.settings.settings",
        replace(
            settings,
            environment="test",
            ingestion_mode="unknown",
            secret_key="test-only-secret-key-that-is-at-least-32-bytes",
        ),
    )
    with pytest.raises(
        RuntimeError, match="INGESTION_MODE must be either inline or queue"
    ):
        validate_settings()


@pytest.mark.parametrize(
    ("database_url", "expected"),
    [
        ("postgres://db.example/ria", "postgresql+psycopg://db.example/ria"),
        ("postgresql://db.example/ria", "postgresql+psycopg://db.example/ria"),
        (
            "postgresql+psycopg://db.example/ria",
            "postgresql+psycopg://db.example/ria",
        ),
        ("sqlite:///./data/ria.db", "sqlite:///./data/ria.db"),
    ],
)
def test_database_url_uses_installed_psycopg_driver(
    database_url: str, expected: str
) -> None:
    assert _normalize_database_url(database_url) == expected


def test_local_upload_storage_saves_reads_and_deletes(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    monkeypatch.setattr(
        storage,
        "settings",
        replace(settings, upload_storage="local", upload_dir=tmp_path),
    )
    stored_path = storage.save_upload("user-1", "source-1", ".txt", b"local data")
    with storage.open_upload(stored_path, "notes.txt") as path:
        assert path.read_bytes() == b"local data"

    storage.delete_upload(stored_path)
    assert not os.path.exists(stored_path)


def test_s3_upload_storage_is_shared_and_deletable(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    objects: dict[tuple[str, str], bytes] = {}
    streams: list[io.BytesIO] = []

    class FakeS3:
        def put_object(self, *, Bucket: str, Key: str, Body: bytes) -> None:
            objects[(Bucket, Key)] = Body

        def get_object(self, *, Bucket: str, Key: str) -> dict[str, io.BytesIO]:
            stream = io.BytesIO(objects[(Bucket, Key)])
            streams.append(stream)
            return {"Body": stream}

        def delete_object(self, *, Bucket: str, Key: str) -> None:
            objects.pop((Bucket, Key), None)

    monkeypatch.setattr(
        storage,
        "settings",
        replace(
            settings,
            upload_storage="s3",
            upload_dir=tmp_path,
            s3_bucket="research-files",
            s3_region="auto",
            s3_access_key_id="test-access-key",
            s3_secret_access_key="test-secret-key",
        ),
    )
    monkeypatch.setattr(storage, "_client", lambda: FakeS3())

    stored_path = storage.save_upload("user-1", "source-1", ".txt", b"shared data")
    assert stored_path == "s3://research-files/users/user-1/sources/source-1.txt"
    with storage.open_upload(stored_path, "notes.txt") as path:
        assert path.read_bytes() == b"shared data"
    assert streams[0].closed
    storage.delete_upload(stored_path)
    assert objects == {}


def test_s3_upload_storage_rejects_references_to_other_buckets(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    monkeypatch.setattr(
        storage,
        "settings",
        replace(settings, upload_storage="s3", upload_dir=tmp_path, s3_bucket="expected"),
    )
    with pytest.raises(ValueError, match="stored object reference is invalid"):
        with storage.open_upload("s3://unexpected/users/user-1/file.txt", "file.txt"):
            pass


@pytest.mark.parametrize(
    ("status_code", "provider_error", "provider_message", "expected"),
    [
        (400, "INVALID_ARGUMENT", "Invalid request.", "Check GEMINI_EMBEDDING_MODEL and EMBEDDING_DIMENSIONS."),
        (404, "NOT_FOUND", "models/gemini-3.6-flash is not found.", "models/gemini-3.6-flash is not found."),
        (400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.", "rejected GEMINI_API_KEY"),
        (403, "PERMISSION_DENIED", "Permission denied.", "has access to the configured model"),
        (429, "RESOURCE_EXHAUSTED", "Quota exceeded.", "quota reached"),
        (503, "UNAVAILABLE", "Service unavailable.", "temporarily unavailable"),
    ],
)
def test_gemini_http_errors_are_actionable_and_do_not_leak_credentials(
    monkeypatch: pytest.MonkeyPatch,
    status_code: int,
    provider_error: str,
    provider_message: str,
    expected: str,
) -> None:
    import httpx

    secret = "must-not-appear-in-error"
    monkeypatch.setattr(
        "app.providers.settings",
        replace(settings, gemini_api_key=secret),
    )

    def rejected_request(*args: object, **kwargs: object) -> httpx.Response:
        request = httpx.Request("POST", "https://generativelanguage.googleapis.com/")
        response = httpx.Response(
            status_code=status_code,
            request=request,
            json={
                "error": {
                    "code": status_code,
                    "status": provider_error,
                    "message": provider_message,
                }
            },
        )
        raise httpx.HTTPStatusError(
            f"HTTP {status_code}", request=request, response=response
        )

    monkeypatch.setattr("app.providers.httpx.post", rejected_request)
    provider = GeminiProvider.__new__(GeminiProvider)
    provider.api_key = secret

    with pytest.raises(ProviderError, match=expected) as exc_info:
        provider._post("models/test:embedContent", {}, "embedding")

    assert secret not in str(exc_info.value)


def test_model_list_filters_for_answer_generation_only() -> None:
    models = _generation_model_names(
        {
            "models": [
                {
                    "name": "models/gemini-3.6-flash",
                    "supportedGenerationMethods": ["generateContent"],
                },
                {
                    "name": "models/gemini-embedding-2",
                    "supportedGenerationMethods": ["embedContent"],
                },
                {"name": "malformed", "supportedGenerationMethods": "generateContent"},
            ]
        }
    )
    assert models == ["gemini-3.6-flash"]


@pytest.mark.parametrize(
    ("operation", "expected_read_timeout"),
    [("answer", 180), ("embedding", 90)],
)
def test_gemini_request_timeout_depends_on_operation(
    monkeypatch: pytest.MonkeyPatch,
    operation: str,
    expected_read_timeout: int,
) -> None:
    import httpx

    timeouts: list[httpx.Timeout] = []

    def successful_request(*args: object, **kwargs: object) -> httpx.Response:
        timeout = kwargs.get("timeout")
        assert isinstance(timeout, httpx.Timeout)
        timeouts.append(timeout)
        request = httpx.Request("POST", "https://generativelanguage.googleapis.com/")
        return httpx.Response(200, request=request, json={"ok": True})

    monkeypatch.setattr("app.providers.httpx.post", successful_request)
    provider = GeminiProvider.__new__(GeminiProvider)
    provider.api_key = "test-api-key"

    assert provider._post("models/test:method", {}, operation) == {"ok": True}
    assert timeouts[0].read == expected_read_timeout


def test_gemini_retries_temporary_server_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import httpx

    responses = [
        httpx.Response(
            503,
            request=httpx.Request("POST", "https://generativelanguage.googleapis.com/"),
            headers={"Retry-After": "3"},
            json={"error": {"status": "UNAVAILABLE", "message": "Try again."}},
        ),
        httpx.Response(
            200,
            request=httpx.Request("POST", "https://generativelanguage.googleapis.com/"),
            json={"answer": "ready"},
        ),
    ]
    delays: list[float] = []
    calls = 0

    def request(*args: object, **kwargs: object) -> httpx.Response:
        nonlocal calls
        response = responses[calls]
        calls += 1
        return response

    monkeypatch.setattr("app.providers.httpx.post", request)
    monkeypatch.setattr("app.providers.time.sleep", delays.append)
    monkeypatch.setattr(
        "app.providers.settings",
        replace(settings, gemini_max_retries=1),
    )
    provider = GeminiProvider.__new__(GeminiProvider)
    provider.api_key = "test-api-key"

    assert provider._post("models/test:generateContent", {}, "answer") == {
        "answer": "ready"
    }
    assert calls == 2
    assert delays == [3.0]


def test_gemini_retries_timeout_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import httpx

    calls = 0

    def request(*args: object, **kwargs: object) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise httpx.ReadTimeout("read timed out")
        return httpx.Response(
            200,
            request=httpx.Request("POST", "https://generativelanguage.googleapis.com/"),
            json={"answer": "ready"},
        )

    monkeypatch.setattr("app.providers.httpx.post", request)
    monkeypatch.setattr("app.providers.time.sleep", lambda _: None)
    monkeypatch.setattr(
        "app.providers.settings",
        replace(settings, gemini_max_retries=1),
    )
    provider = GeminiProvider.__new__(GeminiProvider)
    provider.api_key = "test-api-key"

    assert provider._post("models/test:generateContent", {}, "answer") == {
        "answer": "ready"
    }
    assert calls == 2


def test_uncited_and_unknown_citation_claims_are_removed() -> None:
    answer, labels = keep_cited_sentences(
        "Supported fact [S1]. Unsupported claim [S99]. Uncited assertion.",
        {"S1"},
    )
    assert answer == "Supported fact [S1]."
    assert labels == ["S1"]


def test_public_url_validation_rejects_non_http_schemes_and_loopback() -> None:
    with pytest.raises(WebFetchError):
        validate_public_url("file:///C:/Windows/win.ini")
    with pytest.raises(WebFetchError):
        validate_public_url("http://127.0.0.1/admin")
    with pytest.raises(WebFetchError):
        validate_public_url("http://localhost/")


def test_file_validation_checks_extension_and_pdf_signature() -> None:
    with pytest.raises(HTTPException):
        _validate_upload_bytes("report.exe", b"not an executable")
    with pytest.raises(HTTPException):
        _validate_upload_bytes("report.pdf", b"not a PDF")
    assert _validate_upload_bytes("report.pdf", b"%PDF-1.7 content") == ".pdf"


def test_docx_validation_rejects_non_docx_zip() -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("not-a-document.xml", "<root />")
    with pytest.raises(HTTPException):
        _validate_upload_bytes("document.docx", buffer.getvalue())


def test_html_extraction_removes_active_and_navigation_content() -> None:
    title, content, canonical = parse_html(
        b"""<html><head><title>Research</title><link rel="canonical" href="https://example.com/a"></head>
        <body><nav>Navigation text</nav><main><h1>Findings</h1><p>Evidence paragraph.</p>
        <script>ignore()</script></main></body></html>"""
    )
    assert title == "Research"
    assert "Evidence paragraph." in content
    assert "Navigation text" not in content
    assert "ignore()" not in content
    assert canonical == "https://example.com/a"


def test_docx_parser_preserves_heading_and_table_text(tmp_path) -> None:
    path = tmp_path / "source.docx"
    document = Document()
    document.add_heading("Research findings", level=1)
    document.add_paragraph("Evidence from the document.")
    table = document.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Metric"
    table.cell(0, 1).text = "Value"
    document.save(path)

    blocks = parse_file(path, path.name)
    assert blocks[0].section_path == "Research findings"
    assert any("Evidence from the document." in block.text for block in blocks)
    assert any("Metric | Value" == block.text for block in blocks)
