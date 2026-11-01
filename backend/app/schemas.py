from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, StringConstraints
from typing_extensions import Annotated


ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class UserOut(BaseModel):
    id: str
    email: str
    displayName: str
    avatarUrl: str | None = None
    status: Literal["ONLINE"] = "ONLINE"
    lastSeen: datetime | None = None


class RegisterInput(BaseModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]
    displayName: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class LoginInput(BaseModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class CollectionCreate(BaseModel):
    name: ShortText


class CollectionUpdate(BaseModel):
    name: ShortText


class CollectionOut(BaseModel):
    id: str
    name: str
    visibility: str
    source_count: int
    created_at: datetime
    updated_at: datetime


class UrlSourcesInput(BaseModel):
    urls: list[HttpUrl] = Field(min_length=1, max_length=5)


class SourceOut(BaseModel):
    id: str
    collection_id: str
    source_type: str
    title: str
    original_uri: str | None
    canonical_uri: str | None
    status: str
    error_message: str | None
    chunk_count: int
    last_fetched_at: datetime | None
    created_at: datetime


class ResearchInput(BaseModel):
    query: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=4000)]
    collection_ids: list[str] = Field(min_length=1, max_length=20)
    conversation_id: str | None = None
    edit_message_id: str | None = None
    mode: Literal["quick"] = "quick"


class CitationOut(BaseModel):
    id: str
    source_id: str
    source_type: str
    title: str
    url: str | None = None
    page_number: int | None = None
    section_path: str | None = None
    excerpt: str


class ResearchOut(BaseModel):
    run_id: str
    conversation_id: str
    message_id: str
    answer: str
    citations: list[CitationOut]
    evidence_sufficient: bool
    provider: str
    created_at: datetime


class GuestAskInput(BaseModel):
    query: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]


class GuestAskOut(BaseModel):
    answer: str
    provider: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    citations: list[dict[str, object]]
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationUpdate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]
