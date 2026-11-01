import math
import re
from collections import defaultdict

from qdrant_client import models
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Collection, DocumentChunk, Source
from app.providers import GeminiProvider
from app.settings import settings
from app.vector_store import COLLECTION_NAME, get_vector_store

TOKEN_PATTERN = re.compile(r"[a-z0-9][a-z0-9._-]*", re.IGNORECASE)


def _tokens(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())


def _bm25(query: str, chunks: list[DocumentChunk], limit: int) -> list[DocumentChunk]:
    query_tokens = set(_tokens(query))
    if not chunks or not query_tokens:
        return []
    documents = [_tokens(chunk.text) for chunk in chunks]
    average_length = sum(map(len, documents)) / max(1, len(documents))
    document_frequency: dict[str, int] = defaultdict(int)
    for words in documents:
        for word in set(words):
            document_frequency[word] += 1
    scores: list[tuple[float, DocumentChunk]] = []
    total = len(documents)
    for chunk, words in zip(chunks, documents):
        counts: dict[str, int] = defaultdict(int)
        for word in words:
            counts[word] += 1
        score = 0.0
        for token in query_tokens:
            frequency = counts[token]
            if not frequency:
                continue
            inverse_frequency = math.log(
                1 + (total - document_frequency[token] + 0.5) / (document_frequency[token] + 0.5)
            )
            denominator = frequency + 1.5 * (1 - 0.75 + 0.75 * len(words) / max(1, average_length))
            score += inverse_frequency * frequency * 2.5 / denominator
        if score > 0:
            scores.append((score, chunk))
    scores.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scores[:limit]]


def retrieve_chunks(
    db: Session,
    user_id: str,
    collection_ids: list[str],
    query: str,
    provider: GeminiProvider,
    top_k: int | None = None,
) -> list[tuple[DocumentChunk, Source]]:
    allowed_collections = db.scalars(
        select(Collection.id).where(
            Collection.owner_id == user_id,
            Collection.id.in_(collection_ids),
        )
    ).all()
    if not allowed_collections:
        return []

    size = top_k or settings.retrieval_top_k
    lexical_corpus = db.scalars(
        select(DocumentChunk)
        .join(Source, Source.id == DocumentChunk.source_id)
        .where(
            DocumentChunk.owner_id == user_id,
            DocumentChunk.collection_id.in_(allowed_collections),
            Source.status == "indexed",
        )
        .order_by(DocumentChunk.created_at.desc())
        .limit(5000)
    ).all()
    lexical = _bm25(query, lexical_corpus, size)

    query_vector = provider.embed_query(query)
    vector_result = get_vector_store().query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="owner_id", match=models.MatchValue(value=user_id)
                ),
                models.FieldCondition(
                    key="collection_id", match=models.MatchAny(any=allowed_collections)
                ),
            ]
        ),
        limit=size,
        with_payload=True,
    )
    vector_ids = [str(point.id) for point in vector_result.points]

    scores: dict[str, float] = defaultdict(float)
    for rank, chunk_id in enumerate(vector_ids, start=1):
        scores[chunk_id] += 1 / (60 + rank)
    for rank, chunk in enumerate(lexical, start=1):
        scores[chunk.id] += 1 / (60 + rank)

    if not scores:
        return []
    selected_ids = sorted(scores, key=scores.get, reverse=True)
    rows = db.scalars(
        select(DocumentChunk)
        .join(Source, Source.id == DocumentChunk.source_id)
        .where(
            DocumentChunk.id.in_(selected_ids),
            DocumentChunk.owner_id == user_id,
            DocumentChunk.collection_id.in_(allowed_collections),
            Source.status == "indexed",
        )
    ).all()
    by_id = {chunk.id: chunk for chunk in rows}
    result: list[tuple[DocumentChunk, Source]] = []
    per_source: dict[str, int] = defaultdict(int)
    for chunk_id in selected_ids:
        chunk = by_id.get(chunk_id)
        if chunk is None or per_source[chunk.source_id] >= 3:
            continue
        source = db.get(Source, chunk.source_id)
        if source is not None and source.status == "indexed":
            result.append((chunk, source))
            per_source[source.id] += 1
        if len(result) >= size:
            break
    return result
