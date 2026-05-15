"""Auth session endpoint."""
from fastapi import APIRouter, Header
from pydantic import BaseModel

router = APIRouter()


class UserIdentity(BaseModel):
    """Authenticated user identity."""

    email: str
    displayName: str
    plant: str | None = None


@router.get("/auth/session", response_model=UserIdentity)
async def get_session(
    x_forwarded_access_token: str | None = Header(default=None),
) -> UserIdentity:
    """Return authenticated user identity from Databricks Apps proxy header."""
    if x_forwarded_access_token is None:
        return UserIdentity(email="dev@kerry.com", displayName="Dev User", plant=None)

    # In production the token is validated by Databricks Apps proxy.
    # We trust the header and return a minimal identity.
    return UserIdentity(
        email="user@kerry.com",
        displayName="Kerry User",
        plant=None,
    )
