-- ==============================================================================
-- MySQL Schema Initialization for Document Templating & Authoring Platform
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS docforge;
USE docforge;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_type ENUM('organizer', 'regular') NOT NULL DEFAULT 'regular',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    join_code VARCHAR(64) NOT NULL UNIQUE,
    created_by VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_join_code (join_code),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    team_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    role ENUM('owner', 'manager', 'member') NOT NULL DEFAULT 'member',
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    team_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_team_id (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Templates Table
CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    icon VARCHAR(50) NOT NULL DEFAULT 'file-text',
    visibility ENUM('private', 'public') NOT NULL DEFAULT 'private',
    team_id VARCHAR(64) NULL,
    created_by VARCHAR(64) NULL,
    tags JSON NULL,
    document_elements JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_team_id (team_id),
    INDEX idx_visibility (visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    project_id VARCHAR(64) NULL,
    team_id VARCHAR(64) NULL,
    template_id VARCHAR(64) NOT NULL,
    template_title VARCHAR(255) NOT NULL,
    status ENUM('draft', 'in_review', 'approved', 'published') NOT NULL DEFAULT 'draft',
    author VARCHAR(255) DEFAULT 'Anonymous',
    created_by VARCHAR(64) NULL,
    last_edited_by VARCHAR(64) NULL,
    tags JSON,
    elements_data JSON NOT NULL,
    compiled_markdown LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_project_id (project_id),
    INDEX idx_team_id (team_id),
    INDEX idx_template_id (template_id),
    INDEX idx_status (status),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Default Seed Templates
INSERT INTO templates (id, title, description, category, icon, visibility, tags, document_elements, created_at, updated_at)
VALUES 
(
  'tpl-adr',
  'Architecture Decision Record (ADR)',
  'Capture architectural context, considered options, decision outcome, and trade-offs.',
  'Architecture',
  'layers',
  'public',
  JSON_ARRAY('architecture', 'adr', 'decision', 'system-design'),
  JSON_ARRAY(
    JSON_OBJECT(
      'id', 'context',
      'label', '1. Context & Problem Statement',
      'description', 'Describe the technical context, business driver, or motivation requiring a decision.',
      'field_type', 'markdown',
      'placeholder', 'What problem are we trying to solve?',
      'default_value', '### Context\n- Current system behavior and constraints\n- Business drivers for this change\n- Key technical assumptions',
      'required', true,
      'order', 0,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'decision_drivers',
      'label', '2. Decision Drivers',
      'description', 'Key factors that influence the choice (e.g. latency, team familiarity, licensing).',
      'field_type', 'markdown',
      'placeholder', '- Low latency (<10ms)\n- Zero vendor lock-in',
      'default_value', '- High availability and low latency (<10ms)\n- Clean separation of concerns (Host Nginx -> Container Nginx -> NodeJS -> MySQL)\n- Developer velocity and fast onboarding',
      'required', false,
      'order', 1,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'considered_options',
      'label', '3. Considered Options',
      'description', 'List alternative technologies or designs evaluated.',
      'field_type', 'markdown',
      'placeholder', '### Option 1: ...\n### Option 2: ...',
      'default_value', '### Option 1: [Name]\n- Description: ...\n- Pros: ...\n- Cons: ...\n\n### Option 2: [Name]\n- Description: ...\n- Pros: ...\n- Cons: ...',
      'required', true,
      'order', 2,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'decision_outcome',
      'label', '4. Decision Outcome',
      'description', 'The chosen solution and key justification.',
      'field_type', 'markdown',
      'placeholder', 'Chosen option: ... because ...',
      'default_value', 'Chosen option: **[Option Name]**, because it satisfies our reliability requirements while minimizing maintenance complexity.',
      'required', true,
      'order', 3,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'consequences',
      'label', '5. Pros & Cons of Outcome',
      'description', 'Positive and negative consequences of applying this decision.',
      'field_type', 'markdown',
      'placeholder', 'Pros and Cons...',
      'default_value', '#### Positive Consequences\n- Robust containerized multi-tier stack\n- Independent scaling of frontend and backend services\n\n#### Negative / Trade-offs\n- Requires managing Docker orchestration and MySQL volumes',
      'required', false,
      'order', 4,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'validation_plan',
      'label', '6. Validation & Testing Strategy',
      'description', 'Checklist to validate the architectural decision.',
      'field_type', 'checklist',
      'placeholder', 'Tasks to validate decision',
      'default_value', '- [ ] Verify Docker Compose up starts healthy\n- [ ] Test container Nginx proxy pass to Node backend\n- [ ] Verify MySQL connection pool handles 100 concurrent queries',
      'required', false,
      'order', 5,
      'options', NULL
    )
  ),
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE title=VALUES(title);

INSERT INTO templates (id, title, description, category, icon, visibility, tags, document_elements, created_at, updated_at)
VALUES 
(
  'tpl-prd',
  'Product Requirement Document (PRD)',
  'Define product purpose, target audience, functional specifications, and release milestones.',
  'Product',
  'file-text',
  'public',
  JSON_ARRAY('product', 'prd', 'specification', 'requirements'),
  JSON_ARRAY(
    JSON_OBJECT(
      'id', 'summary',
      'label', 'Executive Summary',
      'description', 'High-level summary of what this feature delivers.',
      'field_type', 'markdown',
      'placeholder', 'Brief overview...',
      'default_value', 'This feature introduces [Feature Name] to empower users to [Primary Benefit].',
      'required', true,
      'order', 0,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'target_audience',
      'label', 'Target Personas & Users',
      'description', 'Target users and pain points.',
      'field_type', 'markdown',
      'placeholder', 'Personas...',
      'default_value', '- **Primary Persona**: Software Engineer / Architect\n- **Secondary Persona**: Product Manager / Technical Writer',
      'required', true,
      'order', 1,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'user_stories',
      'label', 'User Stories & Acceptance Criteria',
      'description', 'User story format: As a [user], I want [capability] so that [benefit].',
      'field_type', 'markdown',
      'placeholder', 'Stories...',
      'default_value', '1. **As a** developer, **I want to** configure document templates **so that** documentation follows standard formats.\n2. **As an** author, **I want to** preview compiled markdown **so that** errors are caught before publishing.',
      'required', true,
      'order', 2,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'functional_specs',
      'label', 'Functional Specifications',
      'description', 'Detailed functional requirements.',
      'field_type', 'markdown',
      'placeholder', 'Functional specs...',
      'default_value', '- [FR-1] Template builder supports reordering and configuring markdown input fields.\n- [FR-2] Document editor auto-generates fields from template items.\n- [FR-3] Preview mode renders clean markdown and offers copy/download .md.',
      'required', true,
      'order', 3,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'milestones',
      'label', 'Release Criteria & Milestones',
      'description', 'Checklist for release readiness.',
      'field_type', 'checklist',
      'placeholder', 'Milestones...',
      'default_value', '- [ ] Containerized build passes without errors\n- [ ] Nginx reverse proxy tested against Node.js API\n- [ ] MySQL persistence verified across container restarts',
      'required', false,
      'order', 4,
      'options', NULL
    )
  ),
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE title=VALUES(title);

INSERT INTO templates (id, title, description, category, icon, visibility, tags, document_elements, created_at, updated_at)
VALUES 
(
  'tpl-postmortem',
  'Incident Postmortem Report',
  'Blameless postmortem analysis for tracking outages, root causes, and remediation roadmap.',
  'Operations',
  'shield-alert',
  'public',
  JSON_ARRAY('operations', 'postmortem', 'incident', 'sre'),
  JSON_ARRAY(
    JSON_OBJECT(
      'id', 'incident_title',
      'label', 'Incident Brief',
      'description', 'One-line overview of the outage or failure.',
      'field_type', 'short_text',
      'placeholder', 'e.g. Database connection pool exhaustion during peak load',
      'default_value', 'Service disruption in API Gateway during morning peak',
      'required', true,
      'order', 0,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'severity',
      'label', 'Severity Level',
      'description', 'Incident classification tier.',
      'field_type', 'select',
      'placeholder', 'Select severity',
      'default_value', 'P1 - High',
      'required', true,
      'order', 1,
      'options', JSON_ARRAY('P0 - Critical (Outage)', 'P1 - High (Degraded)', 'P2 - Medium (Minor)', 'P3 - Low')
    ),
    JSON_OBJECT(
      'id', 'impact_summary',
      'label', 'User Impact & Timeline',
      'description', 'Chronological timeline from detection to resolution.',
      'field_type', 'markdown',
      'placeholder', 'Timeline of events...',
      'default_value', '- **14:02 UTC**: Elevated 500 error alert triggered\n- **14:05 UTC**: On-call engineer paged\n- **14:15 UTC**: Root cause identified and hotfix deployed\n- **14:22 UTC**: Full traffic restored',
      'required', true,
      'order', 2,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'root_cause',
      'label', 'Root Cause Analysis',
      'description', 'Deep dive into underlying causes and contributing factors.',
      'field_type', 'markdown',
      'placeholder', 'Why did it fail?',
      'default_value', 'Unindexed query triggered a full table scan, holding table locks and exhausting backend worker threads.',
      'required', true,
      'order', 3,
      'options', NULL
    ),
    JSON_OBJECT(
      'id', 'action_items',
      'label', 'Corrective & Preventative Actions',
      'description', 'Follow-up tasks with owners and deadlines.',
      'field_type', 'checklist',
      'placeholder', 'Remediation tasks...',
      'default_value', '- [ ] Add compound index to queried table\n- [ ] Configure query execution timeout in MySQL\n- [ ] Add Prometheus alert for long-running transactions',
      'required', true,
      'order', 4,
      'options', NULL
    )
  ),
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE title=VALUES(title);
