# Data Models & Schemas

This directory documents database schemas, entity relationship diagrams (ERDs), cache structures, and message bus contracts.

---

## 1. Schema Conventions
- Table names must be pluralized, lowercase snake_case (e.g. `users`, `document_revisions`).
- All primary keys must be UUIDv7 or auto-incrementing 64-bit integers (`bigint`).
- All tables must include audit timestamps:
  - `created_at`: `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`
  - `updated_at`: `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`

---

## 2. Core Entity Relationship (Example)

```mermaid
erDiagram
    USER ||--o{ DOCUMENT : creates
    DOCUMENT ||--|{ REVISION : contains
    
    USER {
        uuid id PK
        string email UK
        string name
        timestamp created_at
    }
    
    DOCUMENT {
        uuid id PK
        uuid user_id FK
        string title
        string slug UK
        string status
        timestamp created_at
        timestamp updated_at
    }
    
    REVISION {
        uuid id PK
        uuid document_id FK
        integer revision_number
        text content
        timestamp created_at
    }
```
