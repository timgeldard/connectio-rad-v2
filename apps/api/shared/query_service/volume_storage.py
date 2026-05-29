"""Minimal Databricks Unity Catalog Volume storage helper.

Wraps the Files API (https://<host>/api/2.0/fs/files/<path>) for the small
number of binary-payload writes we currently need (envmon floor SVG
underlays). All calls run as the authenticated user via OAuth — no
service-principal path.

Scope is intentionally narrow: upload bytes, download bytes, and existence
check. No directory listing, no multi-part. Add helpers here only when
multiple call sites need them.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from .errors import DatabricksAuthRequiredError, DatabricksQueryError

_log = logging.getLogger(__name__)

_MAX_SVG_BYTES = 2 * 1024 * 1024  # 2 MB


def sanitise_svg(svg_bytes: bytes) -> bytes:
    """Lightweight SVG sanitisation — strip script tags and external refs.

    Defence in depth on top of UC permissions. We accept that this is not a
    full XML sanitiser; the goal is to make accidentally pasting "active"
    content into the volume harder rather than impossible. The browser only
    renders these SVGs inside an `<image>` element (which doesn't execute
    scripts), so the residual risk surface is small.
    """
    if len(svg_bytes) > _MAX_SVG_BYTES:
        raise ValueError(f"SVG exceeds {_MAX_SVG_BYTES} bytes (uploaded {len(svg_bytes)})")
    text = svg_bytes.decode("utf-8", errors="replace")
    if "<svg" not in text.lower():
        raise ValueError("File is not a recognisable SVG document")
    import re
    text = re.sub(r"<script[\s\S]*?</script>", "", text, flags=re.IGNORECASE)
    # Strip on* event handler attributes naively (matches name=" or name=')
    text = re.sub(r"\s+on[a-zA-Z]+\s*=\s*\".*?\"", "", text)
    text = re.sub(r"\s+on[a-zA-Z]+\s*=\s*'.*?'", "", text)
    return text.encode("utf-8")


async def put_volume_file(
    *,
    databricks_host: str,
    volume_path: str,
    body: bytes,
    oauth_token: Optional[str],
    content_type: str = "image/svg+xml",
    timeout_seconds: float = 30.0,
) -> int:
    """Upload ``body`` to ``volume_path`` on Databricks Files API.

    Returns the number of bytes uploaded on success. Raises
    ``DatabricksAuthRequiredError`` when no OAuth token is present.
    """
    if not oauth_token:
        raise DatabricksAuthRequiredError(
            detail="OAuth token is required to write to Unity Catalog Volumes"
        )

    url = f"{databricks_host.rstrip('/')}/api/2.0/fs/files{volume_path}"
    headers = {
        "Authorization": f"Bearer {oauth_token}",
        "Content-Type": content_type,
    }
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.put(url, headers=headers, content=body, params={"overwrite": "true"})
    if response.status_code >= 400:
        _log.warning(
            "Volume upload failed: status=%s path=%s body=%s",
            response.status_code,
            volume_path,
            response.text[:200],
        )
        raise DatabricksQueryError(
            query_name="put_volume_file",
            detail=f"Files API returned HTTP {response.status_code}",
        )
    return len(body)


async def head_volume_file(
    *,
    databricks_host: str,
    volume_path: str,
    oauth_token: Optional[str],
    timeout_seconds: float = 10.0,
) -> bool:
    if not oauth_token:
        return False
    url = f"{databricks_host.rstrip('/')}/api/2.0/fs/files{volume_path}"
    headers = {"Authorization": f"Bearer {oauth_token}"}
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.head(url, headers=headers)
    return response.status_code == 200


async def get_volume_file(
    *,
    databricks_host: str,
    volume_path: str,
    oauth_token: Optional[str],
    timeout_seconds: float = 30.0,
) -> bytes:
    if not oauth_token:
        raise DatabricksAuthRequiredError(
            detail="OAuth token is required to read from Unity Catalog Volumes"
        )
    url = f"{databricks_host.rstrip('/')}/api/2.0/fs/files{volume_path}"
    headers = {"Authorization": f"Bearer {oauth_token}"}
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.get(url, headers=headers)
    if response.status_code == 404:
        raise FileNotFoundError(volume_path)
    if response.status_code >= 400:
        raise DatabricksQueryError(
            query_name="get_volume_file",
            detail=f"Files API returned HTTP {response.status_code}",
        )
    return response.content
