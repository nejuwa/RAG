import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator
from urllib.parse import urlsplit

import boto3
from botocore.config import Config

from app.settings import settings


def _s3_uri(key: str) -> str:
    return f"s3://{settings.s3_bucket}/{key}"


def _parse_s3_uri(stored_path: str) -> tuple[str, str] | None:
    if not stored_path.startswith("s3://"):
        return None
    parsed = urlsplit(stored_path)
    bucket = parsed.netloc
    key = parsed.path.lstrip("/")
    if bucket != settings.s3_bucket or not key or ".." in key.split("/"):
        raise ValueError("The stored object reference is invalid.")
    return bucket, key


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id or None,
        aws_secret_access_key=settings.s3_secret_access_key or None,
        config=Config(s3={"addressing_style": "path"}),
    )


def save_upload(user_id: str, source_id: str, extension: str, content: bytes) -> str:
    key = f"users/{user_id}/sources/{source_id}{extension}"
    if settings.upload_storage == "s3":
        _client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=content,
        )
        return _s3_uri(key)

    destination = (settings.upload_dir / user_id / f"{source_id}{extension}").resolve()
    if settings.upload_dir.resolve() not in destination.parents:
        raise ValueError("The upload destination is invalid.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    return str(destination)


@contextmanager
def open_upload(stored_path: str, filename: str) -> Iterator[Path]:
    object_reference = _parse_s3_uri(stored_path)
    if object_reference is None:
        path = Path(stored_path).resolve()
        if settings.upload_dir.resolve() not in path.parents or not path.is_file():
            raise ValueError("The uploaded file is unavailable.")
        yield path
        return

    bucket, key = object_reference
    response = _client().get_object(Bucket=bucket, Key=key)
    suffix = Path(filename).suffix.lower()
    with tempfile.TemporaryDirectory(prefix="ria-upload-") as directory:
        path = Path(directory) / f"source{suffix}"
        body = response["Body"]
        try:
            with path.open("wb") as target:
                shutil.copyfileobj(body, target)
        finally:
            body.close()
        yield path


def delete_upload(stored_path: str | None) -> None:
    if not stored_path:
        return
    object_reference = _parse_s3_uri(stored_path)
    if object_reference is not None:
        bucket, key = object_reference
        _client().delete_object(Bucket=bucket, Key=key)
        return

    path = Path(stored_path).resolve()
    if settings.upload_dir.resolve() not in path.parents:
        raise ValueError("The stored upload path is invalid.")
    if path.is_file():
        path.unlink()
