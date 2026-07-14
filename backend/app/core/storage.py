"""
S3-compatible object storage client with local filesystem fallback.

Configure via environment variables:
    STORAGE_ENDPOINT_URL    — S3 endpoint URL (leave unset for AWS; set for MinIO/R2/Spaces)
    STORAGE_BUCKET          — bucket name  (required for S3 backend)
    STORAGE_REGION          — AWS/provider region (default: us-east-1)
    AWS_ACCESS_KEY_ID       — access key
    AWS_SECRET_ACCESS_KEY   — secret key
    STORAGE_LOCAL_DIR       — local fallback directory (default: ./local_storage)

When STORAGE_BUCKET is empty the client silently falls back to a local
directory store, so no code changes are needed when moving from dev to prod.

Key naming conventions:
    reports/{tenant_id}/{record_id}_{report_type}_{YYYYMMDD}.pdf
    evidence/{incident_id}/{YYYYMMDDHHMMSS}_{original_filename}
    agent-packages/{version}-{platform}.zip
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional


class StorageClient:
    def __init__(self) -> None:
        from app.core.config import settings

        bucket = getattr(settings, "storage_bucket", "")
        if bucket:
            import boto3
            self._mode   = "s3"
            self._bucket = bucket
            self._s3     = boto3.client(
                "s3",
                endpoint_url=getattr(settings, "storage_endpoint_url", None) or None,
                region_name=getattr(settings, "storage_region", "us-east-1"),
                aws_access_key_id=getattr(settings, "aws_access_key_id", None) or None,
                aws_secret_access_key=getattr(settings, "aws_secret_access_key", None) or None,
            )
        else:
            self._mode = "local"
            local_dir  = getattr(settings, "storage_local_dir", "./local_storage")
            self._local_dir = Path(local_dir).resolve()

    # ── Core operations ────────────────────────────────────────────────────────

    def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Write bytes under *key*; returns the key for convenience."""
        if self._mode == "s3":
            self._s3.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        else:
            dest = (self._local_dir / key).resolve()
            # Guard against path traversal: the resolved destination must stay
            # inside the configured storage root.
            if not str(dest).startswith(str(self._local_dir)):
                raise ValueError(f"Storage key escapes storage root: {key!r}")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        return key

    def get(self, key: str) -> bytes:
        """Read bytes stored under *key*."""
        if self._mode == "s3":
            obj = self._s3.get_object(Bucket=self._bucket, Key=key)
            return obj["Body"].read()
        return (self._local_dir / key).read_bytes()

    def delete(self, key: str) -> None:
        """Delete the object at *key*; no-op if it does not exist."""
        if self._mode == "s3":
            self._s3.delete_object(Bucket=self._bucket, Key=key)
        else:
            p = self._local_dir / key
            if p.exists():
                p.unlink()

    def presigned_url(self, key: str, expiry: int = 300) -> Optional[str]:
        """Return a time-limited download URL (S3 only; None in local mode)."""
        if self._mode == "s3":
            return self._s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expiry,
            )
        return None


# ── Lazy singleton ─────────────────────────────────────────────────────────────
# Instantiated once on first call so import-time startup errors are avoided.

_storage: Optional[StorageClient] = None


def get_storage() -> StorageClient:
    global _storage
    if _storage is None:
        _storage = StorageClient()
    return _storage
