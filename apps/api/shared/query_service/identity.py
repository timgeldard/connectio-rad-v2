"""User identity dataclass — ADR-024 §4."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .errors import DatabricksAuthRequiredError


@dataclass
class UserIdentity:
    """Authenticated user context forwarded from the Databricks Apps OAuth proxy.

    The ``raw_oauth_token`` is the bearer token from the
    ``x-forwarded-access-token`` header injected by Databricks Apps. It must be
    present for any ``databricks-api`` query. If absent, call ``require_user_oauth()``
    to surface a ``DatabricksAuthRequiredError`` — do NOT substitute a service
    principal.
    """

    user_id: str
    email: Optional[str] = None
    raw_oauth_token: Optional[str] = None

    def require_user_oauth(self) -> str:
        """Return the OAuth token or raise ``DatabricksAuthRequiredError``.

        Never falls back to a service principal. Callers that receive
        ``DatabricksAuthRequiredError`` must surface an auth-required error
        to the frontend (HTTP 401) rather than silently degrading to mock data.
        """
        if not self.raw_oauth_token:
            raise DatabricksAuthRequiredError(self.user_id)
        return self.raw_oauth_token
