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
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.1 Verification Tokens Table
CREATE TABLE IF NOT EXISTS verification_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    token VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
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

-- 3. Organization Members Table
CREATE TABLE IF NOT EXISTS organization_members (
    organization_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    role ENUM('owner', 'manager', 'member') NOT NULL DEFAULT 'member',
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, user_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Team Assignment Sets Table (Created first to contain teams)
CREATE TABLE IF NOT EXISTS team_assignment_sets (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org_id (organization_id),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.1 Organization Teams Table (Created within a Team Assignment Set)
CREATE TABLE IF NOT EXISTS organization_teams (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL,
    set_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org_id (organization_id),
    INDEX idx_set_id (set_id),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.2 Organization Team Members Table (Users within organization assigned to team)
CREATE TABLE IF NOT EXISTS organization_team_members (
    team_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'member',
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4.3 Team Assignment Set Items Table (Referential mapping between set and teams)
CREATE TABLE IF NOT EXISTS team_assignment_set_items (
    set_id VARCHAR(64) NOT NULL,
    team_id VARCHAR(64) NOT NULL,
    assigned_role VARCHAR(100) NULL,
    PRIMARY KEY (set_id, team_id),
    INDEX idx_team_id (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NULL,
    association_type ENUM('team', 'individual') NOT NULL DEFAULT 'team',
    team_assignment_set_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_organization_id (organization_id),
    INDEX idx_association_type (association_type),
    INDEX idx_team_assignment_set_id (team_assignment_set_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.1 Project Team Assignments Table (Populated when association_type = 'team')
CREATE TABLE IF NOT EXISTS project_team_assignments (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    team_id VARCHAR(64) NOT NULL,
    assigned_role VARCHAR(100) NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_proj_team (project_id, team_id),
    INDEX idx_project_id (project_id),
    INDEX idx_team_id (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.2 Project Individual Members Table (Populated when association_type = 'individual')
CREATE TABLE IF NOT EXISTS project_individual_members (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'member',
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_proj_indiv_user (project_id, user_id),
    INDEX idx_project_id (project_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Templates Table
CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    icon VARCHAR(50) NOT NULL DEFAULT 'file-text',
    visibility ENUM('private', 'public') NOT NULL DEFAULT 'private',
    organization_id VARCHAR(64) NULL,
    created_by VARCHAR(64) NULL,
    tags JSON NULL,
    document_elements JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_organization_id (organization_id),
    INDEX idx_visibility (visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    project_id VARCHAR(64) NULL,
    organization_id VARCHAR(64) NULL,
    template_id VARCHAR(64) NOT NULL,
    template_title VARCHAR(255) NOT NULL,
    document_type ENUM('personal', 'project_shared') NOT NULL DEFAULT 'project_shared',
    format ENUM('markdown', 'latex') NOT NULL DEFAULT 'markdown',
    is_submittable BOOLEAN NOT NULL DEFAULT FALSE,
    copied_from_id VARCHAR(64) NULL,
    assigned_team_id VARCHAR(64) NULL,
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
    INDEX idx_organization_id (organization_id),
    INDEX idx_template_id (template_id),
    INDEX idx_document_type (document_type),
    INDEX idx_is_submittable (is_submittable),
    INDEX idx_copied_from_id (copied_from_id),
    INDEX idx_assigned_team_id (assigned_team_id),
    INDEX idx_status (status),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.1 Document Submissions Table
CREATE TABLE IF NOT EXISTS document_submissions (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    submission_type ENUM('personal', 'team') NOT NULL,
    user_id VARCHAR(64) NULL,
    team_id VARCHAR(64) NULL,
    status ENUM('draft', 'submitted', 'reviewed') NOT NULL DEFAULT 'draft',
    elements_data JSON NOT NULL,
    compiled_markdown LONGTEXT NOT NULL,
    submitted_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_doc_subm_user (document_id, user_id),
    UNIQUE KEY uk_doc_subm_team (document_id, team_id),
    INDEX idx_document_id (document_id),
    INDEX idx_project_id (project_id),
    INDEX idx_user_id (user_id),
    INDEX idx_team_id (team_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6.2 Submission Comments Table
CREATE TABLE IF NOT EXISTS submission_comments (
    id VARCHAR(64) PRIMARY KEY,
    submission_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_submission_id (submission_id),
    INDEX idx_user_id (user_id)
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

-- ==============================================================================
-- 8. LaTeX Tooling & Multi-File Project Architecture (MySQL 8.0)
-- ==============================================================================

-- 8.1 LaTeX Templates Table
CREATE TABLE IF NOT EXISTS latex_templates (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'Academic',
    compiler VARCHAR(32) NOT NULL DEFAULT 'pdflatex',
    main_file VARCHAR(255) NOT NULL DEFAULT 'main.tex',
    icon VARCHAR(50) NOT NULL DEFAULT 'file-code-2',
    visibility ENUM('private', 'public') NOT NULL DEFAULT 'public',
    organization_id VARCHAR(64) NULL,
    created_by VARCHAR(64) NULL,
    tags JSON NULL,
    template_files JSON NOT NULL,
    thumbnail_url VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org_id (organization_id),
    INDEX idx_visibility (visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.2 LaTeX Projects Table (1-to-1 extension of documents table for latex format)
CREATE TABLE IF NOT EXISTS latex_projects (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    compiler VARCHAR(32) NOT NULL DEFAULT 'pdflatex',
    root_doc_id VARCHAR(64) NULL,
    spell_check_language VARCHAR(10) NOT NULL DEFAULT 'en',
    brand_variation_id VARCHAR(64) NULL,
    image_name VARCHAR(100) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_doc_id (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.3 LaTeX Project Folders Table
CREATE TABLE IF NOT EXISTS latex_folders (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    parent_folder_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_project_id (project_id),
    INDEX idx_parent_folder_id (parent_folder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.4 LaTeX Project Documents Table (text files: .tex, .bib, .sty, .cls, .txt)
CREATE TABLE IF NOT EXISTS latex_docs (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    folder_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    content LONGTEXT NULL,
    rev INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_project_id (project_id),
    INDEX idx_folder_id (folder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.5 LaTeX Project Files Table (binary assets: .png, .jpg, .pdf, .eps)
CREATE TABLE IF NOT EXISTS latex_files (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    folder_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    data LONGBLOB NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.6 LaTeX Compilations Table (history, logs, parsed errors, and output PDF)
CREATE TABLE IF NOT EXISTS latex_compilations (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    status ENUM('success', 'error', 'compiling') NOT NULL,
    compiler VARCHAR(32) NOT NULL DEFAULT 'pdflatex',
    logs LONGTEXT NULL,
    errors JSON NULL,
    pdf_data LONGBLOB NULL,
    pdf_size BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.7 LaTeX Document Snapshots Table (version checkpoints)
CREATE TABLE IF NOT EXISTS latex_doc_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NULL,
    label VARCHAR(255) NULL,
    version INT NOT NULL DEFAULT 1,
    comment TEXT NULL,
    snapshot_data JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8.8 Seed Default LaTeX Templates
INSERT INTO latex_templates (id, title, description, category, compiler, main_file, icon, visibility, tags, template_files, created_at, updated_at)
VALUES
(
  'tpl-latex-ieee',
  'IEEE Conference Article (LaTeX)',
  'Standard two-column IEEE Conference template with abstract, keywords, equations, figure support, and BibTeX citations.',
  'Conference',
  'pdflatex',
  'main.tex',
  'file-code-2',
  'public',
  JSON_ARRAY('ieee', 'conference', 'two-column', 'latex', 'academic'),
  JSON_ARRAY(
    JSON_OBJECT(
      'name', 'main.tex',
      'path', 'main.tex',
      'is_main', true,
      'content', '\\documentclass[twocolumn]{article}\n\\usepackage{amsmath,amsfonts}\n\\usepackage{graphicx}\n\\usepackage{xcolor}\n\n\\title{Adaptive System Framework for High-Performance Distributed Workflows}\n\\author{First Author\\\\\\textit{Research Institute} \\and Second Author\\\\\\textit{Innovation Lab}}\n\\date{\\today}\n\n\\begin{document}\n\n\\maketitle\n\n\\begin{abstract}\nThis paper introduces a novel architectural methodology for coordinating decoupled microservices under intense throughput demands. We evaluate performance across heterogeneous cloud nodes and show consistent improvements in tail latency.\n\\end{abstract}\n\n\\section{Introduction}\nDistributed modern architectures require real-time synchronization with minimal overhead. The trade-offs between strong consistency and low latency have motivated hybrid data stores combining relational models with unstructured document representations \\cite{smith2024distributed}.\n\n\\section{Theoretical Model}\nConsider a distributed network represented by graph $G = (V, E)$, where $V$ represents processing nodes and $E$ signifies network links. The latency function $L(u, v)$ for any edge $(u,v) \\in E$ is given by:\n\n\\begin{equation}\nL(u, v) = \\alpha \\cdot \\frac{D_{packet}}{B(u, v)} + \\delta_{propagation}\n\\end{equation}\n\nwhere $D_{packet}$ is packet size, $B(u, v)$ denotes bandwidth, and $\\delta_{propagation}$ represents link propagation delay.\n\n\\section{Evaluation}\n\\begin{itemize}\n\\item \\textbf{Setup}: Benchmarked with 100 concurrent workers against an enterprise cluster.\n\\item \\textbf{Throughput}: Sustained over 15,000 queries per second with sub-5ms response time.\n\\item \\textbf{Resilience}: Automated failover succeeded within 350 milliseconds.\n\\end{itemize}\n\n\\section{Conclusion}\nThe demonstrated distributed framework delivers predictable performance and robust fault isolation.\n\n\\bibliographystyle{plain}\n\\bibliography{references}\n\n\\end{document}\n'
    ),
    JSON_OBJECT(
      'name', 'references.bib',
      'path', 'references.bib',
      'is_main', false,
      'content', '@article{smith2024distributed,\n  author = {Smith, John and Doe, Jane},\n  title = {Scalable Transactional Topologies in Enterprise Clusters},\n  journal = {IEEE Transactions on Cloud Computing},\n  volume = {12},\n  number = {3},\n  pages = {450--462},\n  year = {2024}\n}\n'
    )
  ),
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE title=VALUES(title);

INSERT INTO latex_templates (id, title, description, category, compiler, main_file, icon, visibility, tags, template_files, created_at, updated_at)
VALUES
(
  'tpl-latex-report',
  'Technical & Academic Report (LaTeX)',
  'Formal report layout with title page, executive summary, table of contents, chapters, and mathematical environments.',
  'Technical Report',
  'pdflatex',
  'main.tex',
  'book-open',
  'public',
  JSON_ARRAY('report', 'technical', 'thesis', 'latex', 'chapters'),
  JSON_ARRAY(
    JSON_OBJECT(
      'name', 'main.tex',
      'path', 'main.tex',
      'is_main', true,
      'content', '\\documentclass[11pt,a4paper]{report}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\\usepackage{hyperref}\n\\usepackage{geometry}\n\\geometry{margin=1in}\n\n\\title{\\textbf{Technical Architecture \\& System Specification}\\\\\\large Comprehensive Engineering Report}\n\\author{Architecture Review Board}\n\\date{\\today}\n\n\\begin{document}\n\n\\maketitle\n\\tableofcontents\n\\newpage\n\n\\chapter{Executive Summary}\nThis document outlines the end-to-end technical specification for our core platform services, detailing the data contracts, storage topologies, and verification criteria.\n\n\\section{Scope and Objectives}\nThe platform provides resilient technical documentation management, multi-format export, and integrated compiling toolchains.\n\n\\chapter{System Architecture}\n\\section{Service Decomposition}\nThe system utilizes decoupled container services communicating via structured REST and binary payload bridges.\n\n\\begin{equation}\nT_{total} = T_{compile} + T_{sync} + T_{render}\n\\end{equation}\n\n\\section{Data Persistence}\nMySQL 8.0 serves as the primary system of record, leveraging relational integrity and ACID guarantees.\n\n\\end{document}\n'
    )
  ),
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE title=VALUES(title);

INSERT INTO latex_templates (id, title, description, category, compiler, main_file, icon, visibility, tags, template_files, created_at, updated_at)
VALUES
(
  'tpl-latex-beamer',
  'Presentation Slides (Beamer LaTeX)',
  'Modern Beamer slide deck with Madrid theme, title page, outline, highlight blocks, and clean typography.',
  'Presentation',
  'pdflatex',
  'main.tex',
  'presentation',
  'public',
  JSON_ARRAY('beamer', 'presentation', 'slides', 'latex'),
  JSON_ARRAY(
    JSON_OBJECT(
      'name', 'main.tex',
      'path', 'main.tex',
      'is_main', true,
      'content', '\\documentclass{beamer}\n\\usetheme{Madrid}\n\\usecolortheme{whale}\n\n\\title[Platform Architecture]{Next-Generation Engineering Platform}\n\\subtitle{Architecture, Workflows \\& Verification}\n\\author{Engineering Team}\n\\institute{DocForge Engineering}\n\\date{\\today}\n\n\\begin{document}\n\n\\begin{frame}\n  \\titlepage\n\\end{frame}\n\n\\begin{frame}{Table of Contents}\n  \\tableofcontents\n\\end{frame}\n\n\\section{Overview}\n\\begin{frame}{Platform Vision \\& Goals}\n  \\begin{itemize}\n    \\item Unified documentation authoring for engineers.\n    \\item Seamless multi-tenant project management.\n    \\item Dual-path execution: Markdown and LaTeX workflows.\n    \\item Integrated live PDF compilation and preview.\n  \\end{itemize}\n\\end{frame}\n\n\\section{Technical Highlights}\n\\begin{frame}{Core Performance Metrics}\n  \\begin{block}{Throughput}\n    Compiled in under 1 second with native Alpine TeX Live.\n  \\end{block}\n  \\begin{alertblock}{Reliability}\n    Strict isolation and automated error line detection.\n  \\end{alertblock}\n\\end{frame}\n\n\\begin{frame}{Summary}\n  \\centering\n  \\textbf{Thank You!}\\\\\n  \\vspace{0.5cm}\n  Questions \\& Discussion\n\\end{frame}\n\n\\end{document}\n'
    )
  ),
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE title=VALUES(title);
