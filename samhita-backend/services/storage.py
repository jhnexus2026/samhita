"""Supabase Storage helper — upload / download / delete files."""
import os
import logging

logger = logging.getLogger(__name__)

_client = None

# Bucket names
BUCKET_DOCUMENTS = "documents"
BUCKET_PRE_AUTH = "pre-auth-docs"
BUCKET_DISCHARGE = "discharge-summaries"
BUCKET_ICP = "icp-scans"
BUCKET_GENERATED_PDFS = "generated-pdfs"

ALL_BUCKETS = [BUCKET_DOCUMENTS, BUCKET_PRE_AUTH, BUCKET_DISCHARGE, BUCKET_ICP, BUCKET_GENERATED_PDFS]


def _get_client():
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return None

    from supabase import create_client
    _client = create_client(url, key)
    return _client


def is_enabled() -> bool:
    return _get_client() is not None


def ensure_bucket(bucket_name: str | None = None):
    """Create a bucket if it doesn't exist. If no name given, create all."""
    client = _get_client()
    if not client:
        return

    buckets = [bucket_name] if bucket_name else ALL_BUCKETS
    for name in buckets:
        try:
            client.storage.get_bucket(name)
            logger.info(f"Supabase Storage bucket '{name}' exists")
        except Exception:
            try:
                client.storage.create_bucket(
                    name,
                    options={"public": True, "file_size_limit": 52428800},  # 50 MB
                )
                logger.info(f"Supabase Storage bucket '{name}' created")
            except Exception as e:
                if "already exists" in str(e).lower():
                    logger.info(f"Bucket '{name}' already exists")
                else:
                    logger.error(f"Failed to create bucket '{name}': {e}")


def upload_file(path: str, file_bytes: bytes, content_type: str = "application/octet-stream", bucket: str = BUCKET_DOCUMENTS) -> str | None:
    """Upload a file to Supabase Storage. Returns public URL or None."""
    client = _get_client()
    if not client:
        return None
    try:
        client.storage.from_(bucket).upload(
            path,
            file_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        return get_public_url(path, bucket)
    except Exception as e:
        logger.error(f"Supabase upload failed for {path}: {e}")
        return None


def get_public_url(path: str, bucket: str = BUCKET_DOCUMENTS) -> str | None:
    """Get the public URL for a file in Supabase Storage."""
    client = _get_client()
    if not client:
        return None
    try:
        res = client.storage.from_(bucket).get_public_url(path)
        return res
    except Exception as e:
        logger.error(f"Failed to get public URL for {path}: {e}")
        return None


def get_signed_url(path: str, bucket: str = BUCKET_DOCUMENTS, expires_in: int = 3600) -> str | None:
    """Get a signed URL for private file access."""
    client = _get_client()
    if not client:
        return None
    try:
        res = client.storage.from_(bucket).create_signed_url(path, expires_in)
        return res.get("signedURL") if isinstance(res, dict) else res
    except Exception as e:
        logger.error(f"Failed to get signed URL for {path}: {e}")
        return None


def delete_file(path: str, bucket: str = BUCKET_DOCUMENTS) -> bool:
    """Delete a file from Supabase Storage."""
    client = _get_client()
    if not client:
        return False
    try:
        client.storage.from_(bucket).remove([path])
        return True
    except Exception as e:
        logger.error(f"Failed to delete {path}: {e}")
        return False


def delete_folder(prefix: str, bucket: str = BUCKET_DOCUMENTS) -> bool:
    """Delete all files under a prefix (folder) in Supabase Storage."""
    client = _get_client()
    if not client:
        return False
    try:
        files = client.storage.from_(bucket).list(prefix)
        if files:
            paths = [f"{prefix}/{f['name']}" for f in files]
            client.storage.from_(bucket).remove(paths)
        return True
    except Exception as e:
        logger.error(f"Failed to delete folder {prefix}: {e}")
        return False
