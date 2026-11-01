from functools import lru_cache

from qdrant_client import QdrantClient, models

from app.settings import settings

COLLECTION_NAME = "research_chunks"


@lru_cache(maxsize=1)
def get_vector_store() -> QdrantClient:
    if settings.environment == "local":
        settings.qdrant_local_path.mkdir(parents=True, exist_ok=True)
        client = QdrantClient(path=str(settings.qdrant_local_path))
    else:
        client = QdrantClient(
            url=settings.qdrant_url, api_key=settings.qdrant_api_key, timeout=10
        )
    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=settings.embedding_dimensions,
                distance=models.Distance.COSINE,
            ),
        )
    return client


def remove_source_vectors(source_id: str) -> None:
    get_vector_store().delete(
        collection_name=COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="source_id", match=models.MatchValue(value=source_id)
                    )
                ]
            )
        ),
        wait=True,
    )


def remove_collection_vectors(collection_id: str) -> None:
    get_vector_store().delete(
        collection_name=COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="collection_id", match=models.MatchValue(value=collection_id)
                    )
                ]
            )
        ),
        wait=True,
    )
