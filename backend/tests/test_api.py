import os
from dataclasses import replace

os.environ["SECRET_KEY"] = "test-only-secret-key-that-is-at-least-32-bytes"
os.environ["DATABASE_URL"] = "sqlite:///./test-ria.db"
os.environ["RIA_ENV"] = "test"

import pytest
from fastapi.testclient import TestClient
from types import SimpleNamespace
from uuid import uuid4
from datetime import datetime, timedelta, timezone

from app import guest_routes, main, research_routes, retrieval
from app.database import Base, SessionLocal, engine
from app.models import Collection, Conversation, DocumentChunk, Message, ResearchRun, Source, User
from app.providers import ProviderError


def test_inline_health_does_not_require_redis(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        main,
        "settings",
        replace(main.settings, ingestion_mode="inline"),
    )
    monkeypatch.setattr(
        main,
        "get_vector_store",
        lambda: SimpleNamespace(get_collections=lambda: []),
    )
    monkeypatch.setattr(
        main.Redis,
        "from_url",
        lambda *_args, **_kwargs: pytest.fail(
            "inline ingestion must not connect to Redis"
        ),
    )

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["checks"]["queue"] == "inline"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    Base.metadata.drop_all(bind=engine)
    monkeypatch.setattr(main, "get_vector_store", lambda: object())
    with TestClient(main.app) as test_client:
        yield test_client
    engine.dispose()


def _csrf(client: TestClient) -> str:
    response = client.get("/api/auth/csrf")
    assert response.status_code == 200
    return response.json()["csrfToken"]


def _register(client: TestClient, email: str) -> dict[str, str]:
    token = _csrf(client)
    response = client.post(
        "/api/auth/register",
        headers={"x-csrf-token": token},
        json={
            "email": email,
            "password": "valid-test-password",
            "displayName": "Researcher",
        },
    )
    assert response.status_code == 200
    return response.json()["data"]


def test_auth_csrf_and_private_collection_ownership(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    rejected = client.post(
        "/api/auth/register",
        json={
            "email": "missing-csrf@example.com",
            "password": "valid-test-password",
            "displayName": "Researcher",
        },
    )
    assert rejected.status_code == 403

    first_user = _register(client, "first@example.com")
    assert first_user["email"] == "first@example.com"
    assert "access_token" in client.cookies
    token = client.cookies.get("csrf_token")
    assert token
    collection = client.post(
        "/api/v1/collections",
        headers={"x-csrf-token": token},
        json={"name": "Private notes"},
    )
    assert collection.status_code == 201
    collection_id = collection.json()["id"]

    monkeypatch.setattr(research_routes, "enqueue_ingestion", lambda *_: None)
    uploaded = client.post(
        f"/api/v1/collections/{collection_id}/sources/files",
        headers={"x-csrf-token": token},
        files={"file": ("notes.txt", b"Private RAG evidence.", "text/plain")},
    )
    assert uploaded.status_code == 202
    assert uploaded.json()["status"] == "queued"

    _register(client, "second@example.com")
    denied = client.get(f"/api/v1/collections/{collection_id}/sources")
    assert denied.status_code == 404
    assert denied.json()["error"]["code"] == "COLLECTION_NOT_FOUND"


def test_logout_revokes_the_current_session(client: TestClient) -> None:
    _register(client, "logout@example.com")
    token = client.cookies.get("csrf_token")
    response = client.post("/api/auth/logout", headers={"x-csrf-token": token})
    assert response.status_code == 204
    assert client.get("/api/users/me").status_code == 401


def test_validation_error_includes_field_names_without_request_values(
    client: TestClient,
) -> None:
    _register(client, "validation@example.com")
    token = client.cookies.get("csrf_token")
    response = client.post(
        "/api/v1/research",
        headers={"x-csrf-token": token},
        json={"query": "", "collection_ids": []},
    )
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert "query" in body["details"]
    assert "collection_ids" in body["details"]
    assert all(isinstance(messages, list) for messages in body["details"].values())


def test_guest_questions_are_public_csrf_protected_and_rate_limited(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(guest_routes, "_attempts", {})

    class FakeProvider:
        def generate_general_answer(self, question: str) -> str:
            assert question == "What is photosynthesis?"
            return "Plants use light to convert carbon dioxide and water into sugars."

    monkeypatch.setattr(guest_routes, "GeminiProvider", FakeProvider)
    rejected = client.post(
        "/api/v1/guest/ask",
        json={"query": "What is photosynthesis?"},
    )
    assert rejected.status_code == 403

    token = _csrf(client)
    for _ in range(5):
        response = client.post(
            "/api/v1/guest/ask",
            headers={"x-csrf-token": token},
            json={"query": "What is photosynthesis?"},
        )
        assert response.status_code == 200
        assert response.json()["answer"].startswith("Plants use light")

    limited = client.post(
        "/api/v1/guest/ask",
        headers={"x-csrf-token": token},
        json={"query": "What is photosynthesis?"},
    )
    assert limited.status_code == 429
    with SessionLocal() as db:
        assert db.query(User).count() == 0


def test_editing_user_message_replaces_later_turns_and_regenerates(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = _register(client, "edit-message@example.com")
    db = SessionLocal()
    try:
        collection = db.query(Collection).filter_by(owner_id=user["id"]).first()
        assert collection is not None
        conversation = Conversation(user_id=user["id"], title="Original question")
        db.add(conversation)
        db.flush()
        edited_message_id = str(uuid4())
        timestamp = datetime.now(timezone.utc)
        db.add_all(
            [
                Message(
                    id=edited_message_id,
                    conversation_id=conversation.id,
                    role="user",
                    content="What is the old question?",
                    citations=[],
                    created_at=timestamp,
                ),
                Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content="The old answer.",
                    citations=[],
                    created_at=timestamp + timedelta(seconds=1),
                ),
                Message(
                    conversation_id=conversation.id,
                    role="user",
                    content="A later question",
                    citations=[],
                    created_at=timestamp + timedelta(seconds=2),
                ),
            ]
        )
        source = Source(
            collection_id=collection.id,
            owner_id=user["id"],
            source_type="file",
            title="evidence.txt",
            status="indexed",
        )
        db.add(source)
        db.flush()
        chunk_id = str(uuid4())
        db.add(
            DocumentChunk(
                id=chunk_id,
                source_id=source.id,
                collection_id=collection.id,
                owner_id=user["id"],
                chunk_index=0,
                text="Water freezes at zero degrees Celsius.",
                token_count=7,
                content_hash="b" * 64,
            )
        )
        conversation_id = conversation.id
        collection_id = collection.id
        db.commit()
    finally:
        db.close()

    class FakeVectorStore:
        def query_points(self, **_: object) -> SimpleNamespace:
            return SimpleNamespace(points=[SimpleNamespace(id=chunk_id)])

    class FakeProvider:
        def embed_query(self, _: str) -> list[float]:
            return [0.25]

        def generate_answer(self, prompt: str) -> str:
            assert "What temperature does water freeze at?" in prompt
            return "Water freezes at zero degrees Celsius [S1]."

    monkeypatch.setattr(retrieval, "get_vector_store", lambda: FakeVectorStore())
    monkeypatch.setattr(research_routes, "GeminiProvider", FakeProvider)
    token = client.cookies.get("csrf_token")
    response = client.post(
        "/api/v1/research",
        headers={"x-csrf-token": token},
        json={
            "query": "What temperature does water freeze at?",
            "collection_ids": [collection_id],
            "conversation_id": conversation_id,
            "edit_message_id": edited_message_id,
        },
    )
    assert response.status_code == 200
    detail = client.get(f"/api/v1/conversations/{conversation_id}")
    assert detail.status_code == 200
    messages = detail.json()["messages"]
    assert [message["role"] for message in messages] == ["user", "assistant"]
    assert messages[0]["id"] == edited_message_id
    assert messages[0]["content"] == "What temperature does water freeze at?"
    assert messages[1]["content"] == "Water freezes at zero degrees Celsius [S1]."


def test_research_only_returns_retrieved_citations_and_rejects_unknown_labels(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = _register(client, "citations@example.com")
    db = SessionLocal()
    try:
        collection = db.query(Collection).filter_by(owner_id=user["id"]).first()
        assert collection is not None
        source = Source(
            collection_id=collection.id,
            owner_id=user["id"],
            source_type="file",
            title="evidence.txt",
            status="indexed",
        )
        db.add(source)
        db.flush()
        chunk_id = str(uuid4())
        db.add(
            DocumentChunk(
                id=chunk_id,
                source_id=source.id,
                collection_id=collection.id,
                owner_id=user["id"],
                chunk_index=0,
                text="RAG combines retrieval with grounded generation.",
                token_count=9,
                content_hash="a" * 64,
            )
        )
        db.commit()
        collection_id = collection.id
    finally:
        db.close()


    class FakeVectorStore:
        def query_points(self, **_: object) -> SimpleNamespace:
            return SimpleNamespace(points=[SimpleNamespace(id=chunk_id)])

    class FakeProvider:
        def embed_query(self, _: str) -> list[float]:
            return [0.25]

        def generate_answer(self, prompt: str) -> str:
            assert "<untrusted-evidence>" in prompt
            return "RAG uses retrieval and generation [S1]. Unsupported claim [S99]."

    monkeypatch.setattr(retrieval, "get_vector_store", lambda: FakeVectorStore())
    monkeypatch.setattr(research_routes, "GeminiProvider", FakeProvider)
    token = client.cookies.get("csrf_token")
    response = client.post(
        "/api/v1/research",
        headers={"x-csrf-token": token},
        json={"query": "What does RAG combine?", "collection_ids": [collection_id]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["evidence_sufficient"] is True
    assert body["run_id"]
    assert len(body["citations"]) == 1
    assert body["citations"][0]["id"] == "S1"
    assert body["citations"][0]["source_id"] == source.id
    assert "Unsupported claim" not in body["answer"]
    assert "S99" not in body["answer"]
    db = SessionLocal()
    try:
        run = db.get(ResearchRun, body["run_id"])
        assert run is not None
        assert run.status == "completed"
        assert run.metrics_json["citation_count"] == 1
    finally:
        db.close()


def test_failed_gemini_request_does_not_leave_duplicate_question_in_history(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = _register(client, "gemini-retry@example.com")
    db = SessionLocal()
    try:
        collection = db.query(Collection).filter_by(owner_id=user["id"]).first()
        assert collection is not None
        conversation = Conversation(user_id=user["id"], title="Research")
        db.add(conversation)
        db.flush()
        source = Source(
            collection_id=collection.id,
            owner_id=user["id"],
            source_type="file",
            title="evidence.txt",
            status="indexed",
        )
        db.add(source)
        db.flush()
        chunk_id = str(uuid4())
        db.add(
            DocumentChunk(
                id=chunk_id,
                source_id=source.id,
                collection_id=collection.id,
                owner_id=user["id"],
                chunk_index=0,
                text="Plants use sunlight to produce sugars.",
                token_count=7,
                content_hash="c" * 64,
            )
        )
        conversation_id = conversation.id
        collection_id = collection.id
        db.commit()
    finally:
        db.close()

    class FakeVectorStore:
        def query_points(self, **_: object) -> SimpleNamespace:
            return SimpleNamespace(points=[SimpleNamespace(id=chunk_id)])

    prompts: list[str] = []

    class FakeProvider:
        def embed_query(self, _: str) -> list[float]:
            return [0.25]

        def generate_answer(self, prompt: str) -> str:
            prompts.append(prompt)
            if len(prompts) == 1:
                raise ProviderError("Gemini is temporarily unavailable.")
            return "Plants use sunlight to produce sugars [S1]."

    monkeypatch.setattr(retrieval, "get_vector_store", lambda: FakeVectorStore())
    monkeypatch.setattr(research_routes, "GeminiProvider", FakeProvider)
    token = client.cookies.get("csrf_token")
    payload = {
        "query": "How do plants make sugars?",
        "collection_ids": [collection_id],
        "conversation_id": conversation_id,
    }

    failed = client.post(
        "/api/v1/research",
        headers={"x-csrf-token": token},
        json=payload,
    )
    assert failed.status_code == 503
    with SessionLocal() as db:
        failed_messages = db.query(Message).filter_by(conversation_id=conversation_id).all()
        failed_runs = db.query(ResearchRun).filter_by(conversation_id=conversation_id).all()
        assert failed_messages == []
        assert len(failed_runs) == 1
        assert failed_runs[0].status == "failed"

    succeeded = client.post(
        "/api/v1/research",
        headers={"x-csrf-token": token},
        json=payload,
    )
    assert succeeded.status_code == 200
    assert "Conversation context" not in prompts[1]
    detail = client.get(f"/api/v1/conversations/{conversation_id}")
    assert [message["role"] for message in detail.json()["messages"]] == ["user", "assistant"]
