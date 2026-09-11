"""Integration tests for Templates and Documents API."""

import pytest
import sys
import os

# Add src/backend to python path for testing
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.storage import storage

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_storage():
    """Ensure clean seed state before each test run."""
    storage.reset_seed_templates()
    storage._save_documents([])
    yield


def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_list_and_get_templates():
    response = client.get("/api/v1/templates")
    assert response.status_code == 200
    templates = response.json()
    assert len(templates) >= 3
    
    # Check default ADR template
    adr_tpl = next((t for t in templates if t["id"] == "tpl-adr"), None)
    assert adr_tpl is not None
    assert adr_tpl["title"] == "Architecture Decision Record (ADR)"
    assert len(adr_tpl["document_elements"]) > 0
    
    # Fetch directly by id
    get_res = client.get(f"/api/v1/templates/{adr_tpl['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == adr_tpl["title"]


def test_create_and_delete_custom_template():
    payload = {
        "title": "Release Notes Template",
        "description": "Template for product release announcements.",
        "category": "Release",
        "icon": "tag",
        "document_elements": [
            {
                "id": "release_version",
                "label": "Version & Release Date",
                "description": "Specify semantic version and target release date.",
                "field_type": "short_text",
                "placeholder": "e.g. v2.4.0 (2026-09-10)",
                "default_value": "v1.0.0",
                "required": True,
                "order": 0,
            },
            {
                "id": "highlights",
                "label": "Release Highlights",
                "description": "Markdown list of key improvements.",
                "field_type": "markdown",
                "placeholder": "Key improvements...",
                "default_value": "### What's New\n- Feature 1\n- Feature 2",
                "required": True,
                "order": 1,
            },
        ],
    }
    create_res = client.post("/api/v1/templates", json=payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["title"] == "Release Notes Template"
    assert len(created_data["document_elements"]) == 2
    template_id = created_data["id"]

    # Delete template
    del_res = client.delete(f"/api/v1/templates/{template_id}")
    assert del_res.status_code == 204

    # Verify 404
    get_res = client.get(f"/api/v1/templates/{template_id}")
    assert get_res.status_code == 404


def test_document_lifecycle_from_template():
    # 1. Create document based on ADR template
    doc_payload = {
        "title": "ADR-0010: Use FastAPI for Backend Service",
        "template_id": "tpl-adr",
        "author": "Tech Lead",
        "tags": ["backend", "python", "fastapi"],
        "elements_data": {
            "context": "We need an async, fast, auto-documented Python REST API framework."
        },
    }
    create_res = client.post("/api/v1/documents", json=doc_payload)
    assert create_res.status_code == 201
    doc = create_res.json()
    assert doc["title"] == doc_payload["title"]
    assert doc["template_id"] == "tpl-adr"
    assert doc["status"] == "draft"
    assert "elements_data" in doc
    # Context was overridden
    assert doc["elements_data"]["context"] == "We need an async, fast, auto-documented Python REST API framework."
    # Other element defaults were populated from template
    assert "considered_options" in doc["elements_data"]
    # Markdown compilation includes title, status, and section
    assert "# ADR-0010: Use FastAPI for Backend Service" in doc["compiled_markdown"]
    assert "We need an async, fast, auto-documented Python REST API framework." in doc["compiled_markdown"]
    doc_id = doc["id"]

    # 2. Update document
    update_payload = {
        "status": "approved",
        "elements_data": {
            "decision_outcome": "Chosen option: FastAPI with Pydantic v2."
        },
    }
    update_res = client.put(f"/api/v1/documents/{doc_id}", json=update_payload)
    assert update_res.status_code == 200
    updated_doc = update_res.json()
    assert updated_doc["status"] == "approved"
    assert updated_doc["elements_data"]["decision_outcome"] == "Chosen option: FastAPI with Pydantic v2."
    assert "FastAPI with Pydantic v2" in updated_doc["compiled_markdown"]

    # 3. Export markdown
    export_res = client.get(f"/api/v1/documents/{doc_id}/export/markdown")
    assert export_res.status_code == 200
    assert "text/markdown" in export_res.headers.get("content-type", "")
    assert "ADR-0010: Use FastAPI for Backend Service" in export_res.text

    # 4. List documents
    list_res = client.get("/api/v1/documents")
    assert list_res.status_code == 200
    docs = list_res.json()
    assert len(docs) == 1
    assert docs[0]["id"] == doc_id

    # 5. Delete document
    del_res = client.delete(f"/api/v1/documents/{doc_id}")
    assert del_res.status_code == 204
    assert client.get(f"/api/v1/documents/{doc_id}").status_code == 404
