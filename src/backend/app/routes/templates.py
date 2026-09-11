"""API routes for Document Templates and Document Element configurations."""

from typing import List
from fastapi import APIRouter, HTTPException, status
from app.models import (
    TemplateCreate,
    TemplateResponse,
    TemplateUpdate,
)
from app.storage import storage

router = APIRouter(prefix="/templates", tags=["Templates"])


@router.get("", response_model=List[TemplateResponse])
def list_templates():
    """List all configured document templates."""
    return storage.list_templates()


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(payload: TemplateCreate):
    """Create a new document template with configured document elements."""
    return storage.create_template(payload)


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: str):
    """Get a specific template by its identifier."""
    template = storage.get_template(template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID '{template_id}' was not found.",
        )
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(template_id: str, payload: TemplateUpdate):
    """Update a template configuration and its document elements."""
    updated = storage.update_template(template_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID '{template_id}' was not found.",
        )
    return updated


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: str):
    """Delete a template."""
    success = storage.delete_template(template_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID '{template_id}' was not found.",
        )
    return None


@router.post("/actions/reset-seeds", response_model=List[TemplateResponse])
def reset_seed_templates():
    """Reset the templates database back to standard default seed templates."""
    return storage.reset_seed_templates()
