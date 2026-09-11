"""Persistent storage repository for Templates and Documents with seed templates and markdown compilation."""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.models import (
    DocumentCreate,
    DocumentElementConfig,
    DocumentElementType,
    DocumentResponse,
    DocumentStatus,
    DocumentUpdate,
    TemplateCreate,
    TemplateResponse,
    TemplateUpdate,
)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
TEMPLATES_FILE = os.path.join(DATA_DIR, "templates.json")
DOCUMENTS_FILE = os.path.join(DATA_DIR, "documents.json")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def compile_document_markdown(doc_title: str, doc_status: str, doc_author: str, doc_tags: List[str], template: Optional[TemplateResponse], elements_data: Dict[str, Any]) -> str:
    """Compiles template elements and user input into a clean, complete Markdown document."""
    lines: List[str] = []
    
    # Header block
    lines.append(f"# {doc_title}")
    lines.append("")
    
    meta_badges = []
    if template:
        meta_badges.append(f"**Template:** {template.title}")
    meta_badges.append(f"**Status:** `{doc_status.upper()}`")
    if doc_author:
        meta_badges.append(f"**Author:** {doc_author}")
    if doc_tags:
        tags_str = ", ".join([f"`#{t.strip()}`" for t in doc_tags if t.strip()])
        if tags_str:
            meta_badges.append(f"**Tags:** {tags_str}")
            
    lines.append(" | ".join(meta_badges))
    lines.append("")
    lines.append("---")
    lines.append("")

    if not template:
        # Fallback if no template structure available
        for k, v in elements_data.items():
            lines.append(f"## {k.replace('_', ' ').title()}")
            lines.append("")
            lines.append(str(v))
            lines.append("")
        return "\n".join(lines)

    # Sort elements by configured order
    sorted_elements = sorted(template.document_elements, key=lambda e: e.order)

    for elem in sorted_elements:
        val = elements_data.get(elem.id, elem.default_value)
        lines.append(f"## {elem.label}")
        lines.append("")

        if elem.field_type == DocumentElementType.MARKDOWN:
            content_str = str(val).strip() if val is not None else ""
            lines.append(content_str if content_str else "_No content provided._")
            lines.append("")

        elif elem.field_type == DocumentElementType.SHORT_TEXT:
            content_str = str(val).strip() if val is not None else ""
            lines.append(content_str if content_str else "_Not specified._")
            lines.append("")

        elif elem.field_type == DocumentElementType.SELECT:
            content_str = str(val).strip() if val is not None else ""
            lines.append(f"**Selection:** `{content_str or 'None'}`")
            lines.append("")

        elif elem.field_type == DocumentElementType.CALLOUT:
            content_str = str(val).strip() if val is not None else ""
            if content_str:
                lines.append("> [!NOTE]")
                for callout_line in content_str.split("\n"):
                    lines.append(f"> {callout_line}")
            else:
                lines.append("> [!NOTE]\n> _No notes provided._")
            lines.append("")

        elif elem.field_type == DocumentElementType.CODE:
            content_str = str(val) if val is not None else ""
            lines.append("```")
            lines.append(content_str)
            lines.append("```")
            lines.append("")

        elif elem.field_type == DocumentElementType.CHECKLIST:
            if isinstance(val, list):
                for item in val:
                    if isinstance(item, dict):
                        checked = "[x]" if item.get("checked") else "[ ]"
                        lines.append(f"- {checked} {item.get('text', '')}")
                    else:
                        lines.append(f"- [ ] {str(item)}")
            elif isinstance(val, str) and val.strip():
                # Process lines
                for line in val.split("\n"):
                    trimmed = line.strip()
                    if trimmed.startswith("- [ ]") or trimmed.startswith("- [x]"):
                        lines.append(trimmed)
                    elif trimmed:
                        lines.append(f"- [ ] {trimmed}")
            else:
                lines.append("- [ ] _No checklist items entered._")
            lines.append("")

    return "\n".join(lines)


def get_default_seed_templates() -> List[Dict[str, Any]]:
    now = _now_iso()
    return [
        {
            "id": "tpl-adr",
            "title": "Architecture Decision Record (ADR)",
            "description": "Standardized record to capture significant architectural decisions, trade-offs, and rationale.",
            "category": "Architecture",
            "icon": "layers",
            "created_at": now,
            "updated_at": now,
            "document_elements": [
                {
                    "id": "context",
                    "label": "1. Context & Problem Statement",
                    "description": "Describe the technical issue, business driver, or motivation requiring a decision.",
                    "field_type": "markdown",
                    "placeholder": "What problem are we trying to solve?",
                    "default_value": "Describe the context and problem statement here. For example:\n- Current system behavior and constraints\n- Business drivers for this change\n- Key assumptions",
                    "required": True,
                    "order": 0,
                    "options": None,
                },
                {
                    "id": "decision_drivers",
                    "label": "2. Decision Drivers",
                    "description": "Key factors that influence the choice (e.g. latency, team familiarity, licensing).",
                    "field_type": "markdown",
                    "placeholder": "- Low latency (<10ms)\n- Zero vendor lock-in",
                    "default_value": "- Developer velocity and fast onboarding\n- High availability and disaster recovery\n- Operational cost efficiency",
                    "required": False,
                    "order": 1,
                    "options": None,
                },
                {
                    "id": "considered_options",
                    "label": "3. Considered Options",
                    "description": "List alternative technologies or designs evaluated.",
                    "field_type": "markdown",
                    "placeholder": "### Option A: ...\n### Option B: ...",
                    "default_value": "### Option 1: [Name]\n- Description: ...\n- Pros: ...\n- Cons: ...\n\n### Option 2: [Name]\n- Description: ...\n- Pros: ...\n- Cons: ...",
                    "required": True,
                    "order": 2,
                    "options": None,
                },
                {
                    "id": "decision_outcome",
                    "label": "4. Decision Outcome",
                    "description": "The chosen solution and key justification.",
                    "field_type": "markdown",
                    "placeholder": "Chosen option: ... because ...",
                    "default_value": "Chosen option: **[Option Name]**, because it satisfies our latency and reliability requirements while minimizing maintenance complexity.",
                    "required": True,
                    "order": 3,
                    "options": None,
                },
                {
                    "id": "consequences",
                    "label": "5. Pros & Cons of the Outcome",
                    "description": "Positive and negative consequences of applying this decision.",
                    "field_type": "markdown",
                    "placeholder": "Positive consequences:\n- ...\nNegative consequences:\n- ...",
                    "default_value": "#### Positive Consequences\n- Immediate throughput boost\n- Simplified client API\n\n#### Negative / Trade-off Consequences\n- Adds operational overhead for Redis cluster\n- Requires cache invalidation handling",
                    "required": False,
                    "order": 4,
                    "options": None,
                },
                {
                    "id": "validation_plan",
                    "label": "6. Validation & Testing Strategy",
                    "description": "How will we prove this decision succeeds in production?",
                    "field_type": "checklist",
                    "placeholder": "Tasks to validate decision",
                    "default_value": "- [ ] Benchmark throughput under 10k req/sec load\n- [ ] Chaos test node failover in staging\n- [ ] Verify Prometheus alerts and Grafana dashboards",
                    "required": False,
                    "order": 5,
                    "options": None,
                },
            ],
        },
        {
            "id": "tpl-prd",
            "title": "Product Requirement Document (PRD)",
            "description": "Define product purpose, target audience, functional specifications, and release milestones.",
            "category": "Product",
            "icon": "file-text",
            "created_at": now,
            "updated_at": now,
            "document_elements": [
                {
                    "id": "summary",
                    "label": "Executive Summary",
                    "description": "High-level summary of what this product/feature delivers and why now.",
                    "field_type": "markdown",
                    "placeholder": "Brief 2-3 paragraph overview...",
                    "default_value": "This feature introduces [Feature Name] to empower users to [Primary Value Proposition].",
                    "required": True,
                    "order": 0,
                    "options": None,
                },
                {
                    "id": "target_audience",
                    "label": "Target Personas & Users",
                    "description": "Who uses this product and what are their pain points?",
                    "field_type": "markdown",
                    "placeholder": "User persona details...",
                    "default_value": "- **Primary Persona**: Software Engineer / Tech Lead\n- **Secondary Persona**: Product Manager / Technical Writer",
                    "required": True,
                    "order": 1,
                    "options": None,
                },
                {
                    "id": "user_stories",
                    "label": "User Stories & Acceptance Criteria",
                    "description": "User story format: As a [user], I want [capability] so that [benefit].",
                    "field_type": "markdown",
                    "placeholder": "User stories...",
                    "default_value": "1. **As a** developer, **I want to** configure reusable document elements **so that** my team standardizes docs.\n2. **As an** author, **I want to** preview markdown live **so that** formatting errors are caught early.",
                    "required": True,
                    "order": 2,
                    "options": None,
                },
                {
                    "id": "functional_requirements",
                    "label": "Functional Requirements",
                    "description": "Detailed functional requirements and technical behaviors.",
                    "field_type": "markdown",
                    "placeholder": "Specific system requirements...",
                    "default_value": "- [FR-1] Template builder must allow adding, removing, and reordering elements.\n- [FR-2] Document editor must support live markdown preview and auto-saving.\n- [FR-3] Users can export compiled documents as clean Markdown (.md).",
                    "required": True,
                    "order": 3,
                    "options": None,
                },
                {
                    "id": "milestones",
                    "label": "Release Criteria & Milestones",
                    "description": "Definition of Done and go-live checklist.",
                    "field_type": "checklist",
                    "placeholder": "Checklist for launch...",
                    "default_value": "- [ ] Unit & Integration test coverage > 85%\n- [ ] Usability testing with 3 team members\n- [ ] Documentation published to docs hub",
                    "required": False,
                    "order": 4,
                    "options": None,
                },
            ],
        },
        {
            "id": "tpl-postmortem",
            "title": "Incident Postmortem Report",
            "description": "Blameless postmortem analysis for tracking system outages and remediation steps.",
            "category": "Operations",
            "icon": "shield-alert",
            "created_at": now,
            "updated_at": now,
            "document_elements": [
                {
                    "id": "incident_title",
                    "label": "Incident Brief",
                    "description": "Short one-line description of the outage or failure.",
                    "field_type": "short_text",
                    "placeholder": "e.g. Database connection pool exhaustion during flash sale",
                    "default_value": "Service disruption in API Gateway during morning peak",
                    "required": True,
                    "order": 0,
                    "options": None,
                },
                {
                    "id": "severity",
                    "label": "Severity Level",
                    "description": "Incident classification tier.",
                    "field_type": "select",
                    "placeholder": "Select severity",
                    "default_value": "P1 - High",
                    "required": True,
                    "order": 1,
                    "options": ["P0 - Critical (Outage)", "P1 - High (Degraded)", "P2 - Medium (Minor)", "P3 - Low"],
                },
                {
                    "id": "impact_summary",
                    "label": "User Impact & Timeline",
                    "description": "Chronological timeline from detection to resolution.",
                    "field_type": "markdown",
                    "placeholder": "Timeline of events...",
                    "default_value": "- **14:02 UTC**: Alert fired on elevated 500 error rate (18%)\n- **14:05 UTC**: On-call engineer paged\n- **14:12 UTC**: Root cause identified as stale cache lock\n- **14:20 UTC**: Cache cluster restarted and traffic recovered",
                    "required": True,
                    "order": 2,
                    "options": None,
                },
                {
                    "id": "root_cause",
                    "label": "Root Cause Analysis (5 Whys)",
                    "description": "Deep dive into underlying causes and contributing factors.",
                    "field_type": "markdown",
                    "placeholder": "Why did it fail?",
                    "default_value": "The root cause was an unhandled connection timeout when the cache cluster reached max capacity, causing queries to pile up and exhaust the web worker threads.",
                    "required": True,
                    "order": 3,
                    "options": None,
                },
                {
                    "id": "action_items",
                    "label": "Corrective & Preventative Actions",
                    "description": "Follow-up tasks with owners and deadlines to prevent recurrence.",
                    "field_type": "checklist",
                    "placeholder": "Remediation tasks...",
                    "default_value": "- [ ] Add circuit breaker pattern for cache timeouts\n- [ ] Increase database connection pool headroom by 50%\n- [ ] Run load test with simulated cache outage",
                    "required": True,
                    "order": 4,
                    "options": None,
                },
            ],
        },
    ]


class StorageRepository:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self._ensure_seed_data()

    def _ensure_seed_data(self):
        if not os.path.exists(TEMPLATES_FILE) or os.path.getsize(TEMPLATES_FILE) == 0:
            self.reset_seed_templates()
        if not os.path.exists(DOCUMENTS_FILE) or os.path.getsize(DOCUMENTS_FILE) == 0:
            self._save_documents([])

    def _load_templates(self) -> List[Dict[str, Any]]:
        try:
            with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_templates(self, templates: List[Dict[str, Any]]):
        with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
            json.dump(templates, f, indent=2)

    def _load_documents(self) -> List[Dict[str, Any]]:
        try:
            with open(DOCUMENTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_documents(self, documents: List[Dict[str, Any]]):
        with open(DOCUMENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(documents, f, indent=2)

    def reset_seed_templates(self) -> List[TemplateResponse]:
        seeds = get_default_seed_templates()
        self._save_templates(seeds)
        return [TemplateResponse(**s) for s in seeds]

    # Template Methods
    def list_templates(self) -> List[TemplateResponse]:
        raw = self._load_templates()
        return [TemplateResponse(**t) for t in raw]

    def get_template(self, template_id: str) -> Optional[TemplateResponse]:
        raw = self._load_templates()
        for t in raw:
            if t["id"] == template_id:
                return TemplateResponse(**t)
        return None

    def create_template(self, payload: TemplateCreate) -> TemplateResponse:
        raw = self._load_templates()
        new_id = f"tpl-{uuid.uuid4().hex[:8]}"
        now = _now_iso()
        
        # Ensure order indexes are sequential
        elements = []
        for idx, elem in enumerate(payload.document_elements):
            elem_dict = elem.model_dump()
            elem_dict["order"] = idx
            elements.append(elem_dict)

        template_data = {
            "id": new_id,
            "title": payload.title,
            "description": payload.description,
            "category": payload.category,
            "icon": payload.icon,
            "document_elements": elements,
            "created_at": now,
            "updated_at": now,
        }
        raw.append(template_data)
        self._save_templates(raw)
        return TemplateResponse(**template_data)

    def update_template(self, template_id: str, payload: TemplateUpdate) -> Optional[TemplateResponse]:
        raw = self._load_templates()
        for i, t in enumerate(raw):
            if t["id"] == template_id:
                if payload.title is not None:
                    t["title"] = payload.title
                if payload.description is not None:
                    t["description"] = payload.description
                if payload.category is not None:
                    t["category"] = payload.category
                if payload.icon is not None:
                    t["icon"] = payload.icon
                if payload.document_elements is not None:
                    elements = []
                    for idx, elem in enumerate(payload.document_elements):
                        elem_dict = elem.model_dump()
                        elem_dict["order"] = idx
                        elements.append(elem_dict)
                    t["document_elements"] = elements
                t["updated_at"] = _now_iso()
                raw[i] = t
                self._save_templates(raw)
                return TemplateResponse(**t)
        return None

    def delete_template(self, template_id: str) -> bool:
        raw = self._load_templates()
        initial_len = len(raw)
        raw = [t for t in raw if t["id"] != template_id]
        if len(raw) < initial_len:
            self._save_templates(raw)
            return True
        return False

    # Document Methods
    def list_documents(self, template_id: Optional[str] = None, search: Optional[str] = None) -> List[DocumentResponse]:
        raw = self._load_documents()
        results: List[DocumentResponse] = []
        for d in raw:
            if template_id and d.get("template_id") != template_id:
                continue
            if search:
                s_lower = search.lower()
                title_match = s_lower in d.get("title", "").lower()
                tag_match = any(s_lower in t.lower() for t in d.get("tags", []))
                if not (title_match or tag_match):
                    continue
            results.append(DocumentResponse(**d))
        # Sort by updated_at descending
        results.sort(key=lambda x: x.updated_at, reverse=True)
        return results

    def get_document(self, document_id: str) -> Optional[DocumentResponse]:
        raw = self._load_documents()
        for d in raw:
            if d["id"] == document_id:
                return DocumentResponse(**d)
        return None

    def create_document(self, payload: DocumentCreate) -> DocumentResponse:
        template = self.get_template(payload.template_id)
        if not template:
            raise ValueError(f"Template with ID '{payload.template_id}' not found.")

        raw_docs = self._load_documents()
        new_id = f"doc-{uuid.uuid4().hex[:8]}"
        now = _now_iso()

        # Seed initial elements data with template default values if not provided
        initial_data: Dict[str, Any] = {}
        for elem in template.document_elements:
            if elem.id in (payload.elements_data or {}):
                initial_data[elem.id] = payload.elements_data[elem.id]
            else:
                initial_data[elem.id] = elem.default_value

        compiled_md = compile_document_markdown(
            doc_title=payload.title,
            doc_status=DocumentStatus.DRAFT.value,
            doc_author=payload.author or "Anonymous",
            doc_tags=payload.tags or [],
            template=template,
            elements_data=initial_data,
        )

        doc_dict = {
            "id": new_id,
            "title": payload.title,
            "template_id": template.id,
            "template_title": template.title,
            "status": DocumentStatus.DRAFT.value,
            "author": payload.author or "Anonymous",
            "tags": payload.tags or [],
            "elements_data": initial_data,
            "compiled_markdown": compiled_md,
            "created_at": now,
            "updated_at": now,
        }
        raw_docs.append(doc_dict)
        self._save_documents(raw_docs)
        return DocumentResponse(**doc_dict)

    def update_document(self, document_id: str, payload: DocumentUpdate) -> Optional[DocumentResponse]:
        raw_docs = self._load_documents()
        for i, d in enumerate(raw_docs):
            if d["id"] == document_id:
                if payload.title is not None:
                    d["title"] = payload.title
                if payload.status is not None:
                    d["status"] = payload.status.value
                if payload.author is not None:
                    d["author"] = payload.author
                if payload.tags is not None:
                    d["tags"] = payload.tags
                if payload.elements_data is not None:
                    # Merge elements data
                    current_data = d.get("elements_data", {})
                    current_data.update(payload.elements_data)
                    d["elements_data"] = current_data

                d["updated_at"] = _now_iso()

                # Recompile Markdown
                template = self.get_template(d["template_id"])
                d["compiled_markdown"] = compile_document_markdown(
                    doc_title=d["title"],
                    doc_status=d["status"],
                    doc_author=d["author"],
                    doc_tags=d["tags"],
                    template=template,
                    elements_data=d["elements_data"],
                )

                raw_docs[i] = d
                self._save_documents(raw_docs)
                return DocumentResponse(**d)
        return None

    def delete_document(self, document_id: str) -> bool:
        raw_docs = self._load_documents()
        initial_len = len(raw_docs)
        raw_docs = [d for d in raw_docs if d["id"] != document_id]
        if len(raw_docs) < initial_len:
            self._save_documents(raw_docs)
            return True
        return False


# Global singleton instance
storage = StorageRepository()
