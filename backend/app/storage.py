"""
Storage interface for file uploads. Filesystem-backed in dev; swap out for S3/MinIO later.
"""
import os
import uuid
import aiofiles
from fastapi import UploadFile
from app.core.config import settings


async def save_upload(file: UploadFile, subfolder: str = "uploads") -> str:
    """Save an uploaded file and return its relative URL path."""
    ext = os.path.splitext(file.filename or "file")[1].lower() or ".bin"
    filename = f"{uuid.uuid4().hex}{ext}"
    dir_path = os.path.join(settings.UPLOADS_DIR, subfolder)
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, filename)
    async with aiofiles.open(file_path, "wb") as out:
        content = await file.read()
        await out.write(content)
    return f"/uploads/{subfolder}/{filename}"
