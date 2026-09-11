import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'docuser';
const dbPassword = process.env.DB_PASSWORD || 'docpass';
const dbName = process.env.DB_NAME || 'docforge';

export const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function initDatabase(): Promise<void> {
  let connected = false;
  let attempts = 0;
  const maxAttempts = 15;

  while (!connected && attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`[Database] Connecting to MySQL at ${dbHost}:${dbPort}/${dbName} (attempt ${attempts}/${maxAttempts})...`);
      const conn = await pool.getConnection();
      console.log('[Database] MySQL connection established successfully.');

      // Ensure tables exist
      await conn.query(`
        CREATE TABLE IF NOT EXISTS templates (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(100) NOT NULL DEFAULT 'General',
          icon VARCHAR(50) NOT NULL DEFAULT 'file-text',
          document_elements JSON NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          template_id VARCHAR(64) NOT NULL,
          template_title VARCHAR(255) NOT NULL,
          status ENUM('draft', 'in_review', 'approved', 'published') NOT NULL DEFAULT 'draft',
          author VARCHAR(255) DEFAULT 'Anonymous',
          tags JSON,
          elements_data JSON NOT NULL,
          compiled_markdown LONGTEXT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_template_id (template_id),
          INDEX idx_status (status),
          INDEX idx_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Check if templates need seeding
      const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT COUNT(*) as cnt FROM templates');
      if (rows && rows[0] && rows[0].cnt === 0) {
        console.log('[Database] No templates found. Inserting seed templates...');
        await seedDefaultTemplates(conn);
      }

      conn.release();
      connected = true;
    } catch (err: any) {
      console.warn(`[Database] Connection failed: ${err.message}. Retrying in 2 seconds...`);
      await new Promise((res) => setTimeout(res, 2000));
    }
  }

  if (!connected) {
    console.error('[Database] Could not connect to MySQL after maximum retries. Continuing startup...');
  }
}

export async function seedDefaultTemplates(conn?: mysql.PoolConnection): Promise<void> {
  const runner = conn || (await pool.getConnection());
  try {
    const seedAdrElements = [
      {
        id: 'context',
        label: '1. Context & Problem Statement',
        description: 'Describe the technical context, business driver, or motivation requiring a decision.',
        field_type: 'markdown',
        placeholder: 'What problem are we trying to solve?',
        default_value: '### Context\n- Current system behavior and constraints\n- Business drivers for this change\n- Key technical assumptions',
        required: true,
        order: 0,
        options: null,
      },
      {
        id: 'decision_drivers',
        label: '2. Decision Drivers',
        description: 'Key factors that influence the choice (e.g. latency, team familiarity, licensing).',
        field_type: 'markdown',
        placeholder: '- Low latency (<10ms)\n- Zero vendor lock-in',
        default_value: '- High availability and low latency (<10ms)\n- Clean separation of concerns (Host Nginx -> Container Nginx -> NodeJS -> MySQL)\n- Developer velocity and fast onboarding',
        required: false,
        order: 1,
        options: null,
      },
      {
        id: 'considered_options',
        label: '3. Considered Options',
        description: 'List alternative technologies or designs evaluated.',
        field_type: 'markdown',
        placeholder: '### Option 1: ...\n### Option 2: ...',
        default_value: '### Option 1: [Name]\n- Description: ...\n- Pros: ...\n- Cons: ...\n\n### Option 2: [Name]\n- Description: ...\n- Pros: ...\n- Cons: ...',
        required: true,
        order: 2,
        options: null,
      },
      {
        id: 'decision_outcome',
        label: '4. Decision Outcome',
        description: 'The chosen solution and key justification.',
        field_type: 'markdown',
        placeholder: 'Chosen option: ... because ...',
        default_value: 'Chosen option: **[Option Name]**, because it satisfies our reliability requirements while minimizing maintenance complexity.',
        required: true,
        order: 3,
        options: null,
      },
      {
        id: 'consequences',
        label: '5. Pros & Cons of Outcome',
        description: 'Positive and negative consequences of applying this decision.',
        field_type: 'markdown',
        placeholder: 'Pros and Cons...',
        default_value: '#### Positive Consequences\n- Robust containerized multi-tier stack\n- Independent scaling of frontend and backend services\n\n#### Negative / Trade-offs\n- Requires managing Docker orchestration and MySQL volumes',
        required: false,
        order: 4,
        options: null,
      },
      {
        id: 'validation_plan',
        label: '6. Validation & Testing Strategy',
        description: 'Checklist to validate the architectural decision.',
        field_type: 'checklist',
        placeholder: 'Tasks to validate decision',
        default_value: '- [ ] Verify Docker Compose up starts healthy\n- [ ] Test container Nginx proxy pass to Node backend\n- [ ] Verify MySQL connection pool handles 100 concurrent queries',
        required: false,
        order: 5,
        options: null,
      },
    ];

    const seedPrdElements = [
      {
        id: 'summary',
        label: 'Executive Summary',
        description: 'High-level summary of what this feature delivers.',
        field_type: 'markdown',
        placeholder: 'Brief overview...',
        default_value: 'This feature introduces [Feature Name] to empower users to [Primary Benefit].',
        required: true,
        order: 0,
        options: null,
      },
      {
        id: 'target_audience',
        label: 'Target Personas & Users',
        description: 'Target users and pain points.',
        field_type: 'markdown',
        placeholder: 'Personas...',
        default_value: '- **Primary Persona**: Software Engineer / Architect\n- **Secondary Persona**: Product Manager / Technical Writer',
        required: true,
        order: 1,
        options: null,
      },
      {
        id: 'user_stories',
        label: 'User Stories & Acceptance Criteria',
        description: 'User story format: As a [user], I want [capability] so that [benefit].',
        field_type: 'markdown',
        placeholder: 'Stories...',
        default_value: '1. **As a** developer, **I want to** configure document templates **so that** documentation follows standard formats.\n2. **As an** author, **I want to** preview compiled markdown **so that** errors are caught before publishing.',
        required: true,
        order: 2,
        options: null,
      },
      {
        id: 'functional_specs',
        label: 'Functional Specifications',
        description: 'Detailed functional requirements.',
        field_type: 'markdown',
        placeholder: 'Functional specs...',
        default_value: '- [FR-1] Template builder supports reordering and configuring markdown input fields.\n- [FR-2] Document editor auto-generates fields from template items.\n- [FR-3] Preview mode renders clean markdown and offers copy/download .md.',
        required: true,
        order: 3,
        options: null,
      },
      {
        id: 'milestones',
        label: 'Release Criteria & Milestones',
        description: 'Checklist for release readiness.',
        field_type: 'checklist',
        placeholder: 'Milestones...',
        default_value: '- [ ] Containerized build passes without errors\n- [ ] Nginx reverse proxy tested against Node.js API\n- [ ] MySQL persistence verified across container restarts',
        required: false,
        order: 4,
        options: null,
      },
    ];

    const seedPostmortemElements = [
      {
        id: 'incident_title',
        label: 'Incident Brief',
        description: 'One-line overview of the outage or failure.',
        field_type: 'short_text',
        placeholder: 'e.g. Database connection pool exhaustion during peak load',
        default_value: 'Service disruption in API Gateway during morning peak',
        required: true,
        order: 0,
        options: null,
      },
      {
        id: 'severity',
        label: 'Severity Level',
        description: 'Incident classification tier.',
        field_type: 'select',
        placeholder: 'Select severity',
        default_value: 'P1 - High',
        required: true,
        order: 1,
        options: ['P0 - Critical (Outage)', 'P1 - High (Degraded)', 'P2 - Medium (Minor)', 'P3 - Low'],
      },
      {
        id: 'impact_summary',
        label: 'User Impact & Timeline',
        description: 'Chronological timeline from detection to resolution.',
        field_type: 'markdown',
        placeholder: 'Timeline of events...',
        default_value: '- **14:02 UTC**: Elevated 500 error alert triggered\n- **14:05 UTC**: On-call engineer paged\n- **14:15 UTC**: Root cause identified and hotfix deployed\n- **14:22 UTC**: Full traffic restored',
        required: true,
        order: 2,
        options: null,
      },
      {
        id: 'root_cause',
        label: 'Root Cause Analysis',
        description: 'Deep dive into underlying causes and contributing factors.',
        field_type: 'markdown',
        placeholder: 'Why did it fail?',
        default_value: 'Unindexed query triggered a full table scan, holding table locks and exhausting backend worker threads.',
        required: true,
        order: 3,
        options: null,
      },
      {
        id: 'action_items',
        label: 'Corrective & Preventative Actions',
        description: 'Follow-up tasks with owners and deadlines.',
        field_type: 'checklist',
        placeholder: 'Remediation tasks...',
        default_value: '- [ ] Add compound index to queried table\n- [ ] Configure query execution timeout in MySQL\n- [ ] Add Prometheus alert for long-running transactions',
        required: true,
        order: 4,
        options: null,
      },
    ];

    const templatesToSeed = [
      {
        id: 'tpl-adr',
        title: 'Architecture Decision Record (ADR)',
        description: 'Capture architectural context, considered options, decision outcome, and trade-offs.',
        category: 'Architecture',
        icon: 'layers',
        elements: seedAdrElements,
      },
      {
        id: 'tpl-prd',
        title: 'Product Requirement Document (PRD)',
        description: 'Define product purpose, target audience, functional specifications, and release milestones.',
        category: 'Product',
        icon: 'file-text',
        elements: seedPrdElements,
      },
      {
        id: 'tpl-postmortem',
        title: 'Incident Postmortem Report',
        description: 'Blameless postmortem analysis for tracking outages, root causes, and remediation roadmap.',
        category: 'Operations',
        icon: 'shield-alert',
        elements: seedPostmortemElements,
      },
    ];

    for (const t of templatesToSeed) {
      await runner.query(
        `INSERT INTO templates (id, title, description, category, icon, document_elements, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE 
           title = VALUES(title),
           description = VALUES(description),
           category = VALUES(category),
           icon = VALUES(icon),
           document_elements = VALUES(document_elements),
           updated_at = NOW()`,
        [t.id, t.title, t.description, t.category, t.icon, JSON.stringify(t.elements)]
      );
    }
  } finally {
    if (!conn) {
      runner.release();
    }
  }
}
