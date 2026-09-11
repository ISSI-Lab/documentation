"""Data models and schemas for Document Elements, Templates, and Documents."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DocumentElementType(str, Enum):
    MARKDOWN = "markdown"
    SHORT_TEXT = "short_text"
    SELECT = "select"
    CALLOUT = "callout"
    CODE = "code"
    CHECKLIST = "checklist"


class DocumentElementConfig(BaseModel):
    id: str = Field(..., description="Unique slug for the element within the template, e.g. 'summary'")
    label: str = Field(..., description="Section title or field label")
    description: str = Field(default="", description="Helpful guidance for the author writing in this section")
    field_type: DocumentElementType = Field(default=DocumentElementType.MARKDOWN, description="Input field type")
    placeholder: str = Field(default="", description="Placeholder hint for the editor")
    default_value: str = Field(default="", description="Starter boilerplate content or template markdown")
    required: bool = Field(default=False, description="Whether this field must be filled")
    order: int = Field(default=0, description="Display order index")
    options: Optional[List[str]] = Field(default=None, description="Choices for select dropdowns")


class TemplateBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Template title")
    description: str = Field(default="", description="Description of the template's purpose")
    category: str = Field(default="General", description="Category grouping, e.g. Architecture, Product")
    icon: str = Field(default="file-text", description="Icon name for visual identification")
    document_elements: List[DocumentElementConfig] = Field(default_factory=list, description="Configured document items")


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    document_elements: Optional[List[DocumentElementConfig]] = None


class TemplateResponse(TemplateBase):
    id: str
    created_at: str
    updated_at: str


class DocumentStatus(str, Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    PUBLISHED = "published"


class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Document title")
    template_id: str = Field(..., description="ID of the template to base this document on")
    author: Optional[str] = Field(default="Anonymous", description="Author name")
    tags: Optional[List[str]] = Field(default_factory=list, description="Categorization tags")
    elements_data: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Key-value mapping of element_id to user entered content"
    )


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    status: Optional[DocumentStatus] = None
    author: Optional[str] = None
    tags: Optional[List[str]] = None
    elements_data: Optional[Dict[str, Any]] = None


class DocumentResponse(BaseModel):
    id: str
    title: str
    template_id: str
    template_title: str
    status: DocumentStatus
    author: str
    tags: List[str]
    elements_data: Dict[str, Any]
    compiled_markdown: str
    created_at: str
    updated_at: str
