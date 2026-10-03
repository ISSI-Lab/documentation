# ADR-0007: Personal And Team Document Submissions And Review System

- **Status**: Accepted
- **Date**: 2026-10-03
- **Deciders**: Core Engineering Team, Platform Architect

---

## Context
Educational, engineering, and organizational workflows require distinct collaborative modes for deliverables:
1. **Personal Documents**: Authored individually. When configured as a deliverable, each individual participant must have their own independent submission that the project creator can review, evaluate, and provide feedback on.
2. **Project Shared Documents**: Authored collaboratively. When configured as a deliverable, submissions must be compiled and submitted **according to team** (shared editing), allowing the project creator to view and review each assigned team's submission.
3. Both document types must support being either submittable deliverables or standalone non-submittable reference documents (`is_submittable: boolean`).
4. To reduce friction, when a participant or team opens their submission, it must not start blank; it should be pre-populated with the project creator's prompt and default element instructions.
5. Project creators need a unified review dashboard to inspect all submissions, track review states, and exchange threaded feedback comments with participants.

---

## Decision

We designed and implemented a full-stack document submissions and creator review architecture:

### 1. Database Schema
- **`documents` Table Enhancements**:
  - `document_type ENUM('personal', 'project_shared') NOT NULL DEFAULT 'project_shared'`: Distinguishes individual authoring from team collaborative editing.
  - `is_submittable BOOLEAN NOT NULL DEFAULT FALSE`: Designates whether a document acts as a submittable deliverable.
- **`document_submissions` Table**:
  - `id VARCHAR(64) PRIMARY KEY`, `document_id VARCHAR(64)`, `project_id VARCHAR(64)`.
  - `submission_type ENUM('personal', 'team') NOT NULL`.
  - `user_id VARCHAR(64) NULL` (for personal submissions), `team_id VARCHAR(64) NULL` (for team submissions).
  - `status ENUM('draft', 'submitted', 'reviewed') NOT NULL DEFAULT 'draft'`.
  - `elements_data JSON NOT NULL`, `compiled_markdown LONGTEXT NOT NULL`.
  - Unique constraints `uk_doc_subm_user (document_id, user_id)` and `uk_doc_subm_team (document_id, team_id)` to prevent duplicate active submissions.
- **`submission_comments` Table**:
  - Threaded review feedback between creators/reviewers and participants: `id VARCHAR(64) PRIMARY KEY`, `submission_id VARCHAR(64)`, `user_id VARCHAR(64)`, `content TEXT`, `created_at`, `updated_at`.

### 2. Backend API Workflow
- **`GET /api/v1/documents/:id/submissions`**: Reviewer view generates a complete roster of all expected participants (for personal documents) or assigned teams (for project shared documents), reporting status (`not_started`, `draft`, `submitted`, `reviewed`).
- **`GET /api/v1/documents/:id/my-submission`**: Auto-initializes the caller's draft pre-populated with creator prompt and element defaults.
- **`PUT /api/v1/documents/:id/submissions/:submissionId`**: Updates draft element responses and dynamically re-compiles markdown.
- **`POST /api/v1/documents/:id/submissions/:submissionId/submit` & `unsubmit`**: Transitions between draft and submitted states with timestamp auditing.
- **`PUT /api/v1/documents/:id/submissions/:submissionId/status`**: Allows project creators/managers to mark submissions as `reviewed` or request revisions.
- **`PUT /api/v1/documents/:id` Creator Guardrail**: Only the document creator can assign or modify the collaboration type (`document_type`) and enable or disable submissions (`is_submittable`). Attempts by non-creators are rejected with `403 Forbidden`.
- **`GET` & `POST /api/v1/documents/:id/submissions/:submissionId/comments`**: Threaded feedback and replies.

### 3. Frontend Architecture
- **`CreateDocumentModal` & `DocumentEditor`**: Added selectors for Collaboration Type (Project Shared vs Personal) and Submittable Deliverable toggle with contextual guidance.
- **Creator-Only Controls in `DocumentEditor`**: If the current user is not the document creator, the Collaboration Type buttons and the Submissions toggle are disabled, display lock badges, and explain that only the creator can modify these settings.
- **"Submission" Button in Document Editing Page**: When a document is configured with submissions enabled, a prominent "Submission" button is rendered in the `DocumentEditor` action header, allowing authors and reviewers to jump directly to the submission workspace and review roster.
- **`DocumentViewer` Tabbed Navigation**: Segmented tabs for `Document Specification`, `Creator Review & Submissions`, and `My Submission` / `Our Team Submission`.
- **`SubmissionReviewDashboard`**: Roster cards, status counters, full markdown inspector, status updater, and review feedback thread.
- **`ParticipantSubmissionWorkspace`**: Form-based response editor, auto-save drafts, submission controls, and creator comment replies.

---

## Consequences

### Positive
- **Clear Separation of Responsibility**: Personal documents track per-person accountability; project shared documents track team collaboration without conflation.
- **Zero Blank Page Problem**: Submissions pre-populate creator defaults, guiding participants on expected deliverable structure.
- **Full Review Loop**: Creators can request revisions (`draft`) or confirm completion (`reviewed`), while maintaining bidirectional feedback history.
- **Strict Integrity**: Database unique constraints prevent duplicate submissions per user or per team.

### Negative / Trade-offs
- Submitting a team document requires team membership verification and shared access control.
- In-memory/dynamic markdown compilation must be kept performant as element schemas expand.
