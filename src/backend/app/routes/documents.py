"""API routes for Documents authoring, editing, and preview."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response, status
from app.models import (
    DocumentCreate,
    DocumentResponse,
    DocumentUpdate,
)
from app.storage import storage

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    template_id: Optional[str] = Query(default=None, description="Filter by template ID"),
    search: Optional[str] = Query(default=None, description="Search term in title or tags"),
):
    """List documents with optional filtering by template or search keyword."""
    return storage.list_documents(template_id=template_id, search=search)


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(payload: DocumentCreate):
    """Create a new document based on a template, initializing element fields with defaults."""
    try:
        return storage.create_document(payload)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str):
    """Retrieve full details of a document including element data and compiled markdown."""
    doc = storage.get_document(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' was not found.",
        )
    return doc


@router.put("/{document_id}", response_model=DocumentResponse)
def update_document(document_id: str, payload: DocumentUpdate):
    """Update a document's title, status, tags, or element contents."""
    updated = storage.update_document(document_id, payload)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' was not found.",
        )
    return updated


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str):
    """Delete a document."""
    success = storage.delete_document(document_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' was not found.",
        )
    return None


@router.get("/{document_id}/export/markdown")
def export_document_markdown(document_id: str):
    """Export pure compiled Markdown content as a downloadable file."""
    doc = storage.get_document(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' was not found.",
        )
    
    clean_filename = "".join(c for c in doc.title.lower().replace(" ", "-") if c.isalnum() or c in "-_")
    if not clean_filename:
        clean_filename = "document"
    
    headers = {
        "Content-Disposition": f'attachment; filename="{clean_filename}.md"'
    }
    return Response(
        content=doc.compiled_markdown,
        media_type="text/markdown; charset=utf-8",
        headers=headers,
    )
