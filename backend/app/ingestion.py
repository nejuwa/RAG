import hashlib
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urljoin
from uuid import uuid4

from qdrant_client import models
from sqlalchemy import delete, select

from app.chunking import TextBlock, chunk_blocks
from app.database import SessionLocal
from app.models import DocumentChunk, Source
from app.parsing import parse_file, parse_html
from app.providers import GeminiProvider, ProviderError
from app.settings import settings
from app.storage import open_upload
from app.vector_store import COLLECTION_NAME, get_vector_store, remove_source_vectors
from app.web_fetch import WebFetchError, fetch_public_page, validate_public_url

logger = logging.getLogger(__name__)


def _extract(source: Source) -> tuple[list[TextBlock], str, str]:
    if source.source_type == "file":
        if not source.stored_path:
            raise ValueError("The uploaded file is unavailable.")
        with open_upload(source.stored_path, source.title) as path:
            blocks = parse_file(path, source.title)
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
        return blocks, source.title, digest
    if not source.original_uri:
        raise ValueError("The web address is unavailable.")
    content_type, body, final_url, original_url = fetch_public_page(source.original_uri)
    source.original_uri = original_url
    source.canonical_uri = final_url
    source.last_fetched_at = datetime.now(timezone.utc)
    if content_type == "text/plain":
        text = body.decode("utf-8", errors="replace")
        blocks = [TextBlock(part.strip()) for part in re.split(r"\n\s*\n", text) if part.strip()]
        title = final_url
    else:
        title, text, canonical = parse_html(body)
        blocks = [TextBlock(part.strip()) for part in re.split(r"\n\s*\n", text) if part.strip()]
        if canonical:
            try:
                source.canonical_uri = validate_public_url(urljoin(final_url, canonical))
            except WebFetchError:
                source.canonical_uri = final_url
    if not blocks:
        raise ValueError("No readable text was found at this URL.")
    return blocks, title, hashlib.sha256(body).hexdigest()


def _safe_error(exc: Exception) -> str:
    if isinstance(exc, (ValueError, WebFetchError, ProviderError)):
        return str(exc)[:300]
    return "The source could not be indexed. Check the file or URL and retry."


def process_source(source_id: str) -> None:
    db = SessionLocal()
    try:
        source = db.get(Source, source_id)
        if source is None or source.status == "deleted":
            return
        source.status = "processing"
        source.error_message = None
        db.execute(delete(DocumentChunk).where(DocumentChunk.source_id == source_id))
        db.commit()

        blocks, title, content_hash = _extract(source)
        chunks = chunk_blocks(blocks, settings.chunk_size, settings.chunk_overlap)
        if not chunks:
            raise ValueError("No readable text was found in this source.")
        provider = GeminiProvider()
        vectors: list[list[float]] = []
        for start in range(0, len(chunks), 100):
            vectors.extend(provider.embed_documents([item.text for item in chunks[start : start + 100]]))
        if len(vectors) != len(chunks):
            raise ProviderError("The embedding provider returned an incomplete result.")

        rows = [
            DocumentChunk(
                id=str(uuid4()),
                source_id=source.id,
                collection_id=source.collection_id,
                owner_id=source.owner_id,
                chunk_index=index,
                text=item.text,
                page_number=item.page_number,
                section_path=item.section_path,
                token_count=max(1, len(item.text) // 4),
                content_hash=hashlib.sha256(item.text.encode("utf-8")).hexdigest(),
            )
            for index, item in enumerate(chunks)
        ]
        store = get_vector_store()
        remove_source_vectors(source.id)
        store.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=row.id,
                    vector=vector,
                    payload={
                        "owner_id": row.owner_id,
                        "collection_id": row.collection_id,
                        "source_id": row.source_id,
                        "chunk_id": row.id,
                        "chunk_index": row.chunk_index,
                    },
                )
                for row, vector in zip(rows, vectors)
            ],
            wait=True,
        )
        source.title = title[:500]
        source.content_hash = content_hash
        source.status = "indexed"
        source.error_message = None
        db.add_all(rows)
        db.commit()
    except Exception as exc:
        logger.exception("Ingestion failed for source %s.", source_id)
        db.rollback()
        source = db.get(Source, source_id)
        if source is not None and source.status != "deleted":
            source.status = "failed"
            source.error_message = _safe_error(exc)
            db.commit()
    finally:
        db.close()
