---
name: dev-helper
description: >-
  Helper skill for managing cross-machine development workflows, including scaffolding
  numbered ADRs, RFCs, and session handoffs.
---

# Developer Workflow Skill

This skill provides step-by-step procedures for distributed developers and AI assistants to manage project lifecycle artifacts.

## Scaffolding New Records

Use the cross-platform CLI tool in `scripts/`:

```bash
# Create a new Architecture Decision Record
python3 scripts/new_record.py adr "use-redis-cache"

# Create a new Request for Comments (Design Proposal)
python3 scripts/new_record.py rfc "websocket-streaming"

# Create a new Product Requirement Document
python3 scripts/new_record.py prd "user-authentication"

# Create a new shift/machine handoff log
python3 scripts/new_record.py handoff "auth-feature-progress"
```

## Validating Documentation & Links

Before pushing commits to GitHub or ending a session:

```bash
python3 scripts/validate_docs.py
```
