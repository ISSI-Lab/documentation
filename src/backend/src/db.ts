import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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

async function ensureColumnExists(
  conn: mysql.PoolConnection,
  tableName: string,
  columnName: string,
  columnDef: string
) {
  try {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, tableName, columnName]
    );
    if (rows && rows[0] && rows[0].cnt === 0) {
      console.log(`[Database] Adding missing column ${columnName} to ${tableName}...`);
      await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${columnName} ${columnDef}`);
    }
  } catch (err: any) {
    console.warn(`[Database] Notice on checking column ${columnName} in ${tableName}:`, err.message);
  }
}

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

      // 1. Users Table
      await conn.query(`
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
      `);

      // 1.1 Verification Tokens Table
      await conn.query(`
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
      `);

      // Migration: Rename teams -> organizations if needed
      try {
        const [orgTableExists] = await conn.query<mysql.RowDataPacket[]>(
          `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'organizations'`,
          [dbName]
        );
        const [teamTableExists] = await conn.query<mysql.RowDataPacket[]>(
          `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'teams'`,
          [dbName]
        );
        if (teamTableExists[0]?.cnt > 0 && orgTableExists[0]?.cnt === 0) {
          console.log('[Database] Migrating table teams -> organizations...');
          await conn.query('RENAME TABLE teams TO organizations');
        }
      } catch (err: any) {
        console.warn('[Database] Table migration teams->organizations notice:', err.message);
      }

      // Migration: Rename team_members -> organization_members if needed
      try {
        const [orgMemTableExists] = await conn.query<mysql.RowDataPacket[]>(
          `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'organization_members'`,
          [dbName]
        );
        const [teamMemTableExists] = await conn.query<mysql.RowDataPacket[]>(
          `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'team_members'`,
          [dbName]
        );
        if (teamMemTableExists[0]?.cnt > 0 && orgMemTableExists[0]?.cnt === 0) {
          console.log('[Database] Migrating table team_members -> organization_members...');
          await conn.query('RENAME TABLE team_members TO organization_members');
        }
      } catch (err: any) {
        console.warn('[Database] Table migration team_members->organization_members notice:', err.message);
      }

      // Helper for migrating columns
      async function migrateColumn(tableName: string, oldCol: string, newCol: string, def: string) {
        try {
          const [tableExists] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
            [dbName, tableName]
          );
          if (!tableExists[0] || tableExists[0].cnt === 0) return;

          const [hasOld] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [dbName, tableName, oldCol]
          );
          const [hasNew] = await conn.query<mysql.RowDataPacket[]>(
            `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [dbName, tableName, newCol]
          );
          if (hasOld[0]?.cnt > 0 && hasNew[0]?.cnt === 0) {
            console.log(`[Database] Renaming column ${tableName}.${oldCol} -> ${newCol}...`);
            await conn.query(`ALTER TABLE \`${tableName}\` CHANGE COLUMN \`${oldCol}\` \`${newCol}\` ${def}`);
          }
        } catch (err: any) {
          console.warn(`[Database] Migration notice on ${tableName}.${oldCol}->${newCol}:`, err.message);
        }
      }

      await migrateColumn('organization_members', 'team_id', 'organization_id', 'VARCHAR(64) NOT NULL');
      await migrateColumn('projects', 'team_id', 'organization_id', 'VARCHAR(64) NULL');
      await migrateColumn('templates', 'team_id', 'organization_id', 'VARCHAR(64) NULL');
      await migrateColumn('documents', 'team_id', 'organization_id', 'VARCHAR(64) NULL');

      // 2. Organizations Table
      await conn.query(`
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
      `);

      // 3. Organization Members Table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS organization_members (
          organization_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          role ENUM('owner', 'manager', 'member') NOT NULL DEFAULT 'member',
          joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (organization_id, user_id),
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 4. Team Assignment Sets Table (Created first so teams belong to sets)
      await conn.query(`
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
      `);

      // 4.1 Organization Teams Table (Contains teams within sets)
      await conn.query(`
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
      `);

      // 4.2 Organization Team Members Table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS organization_team_members (
          team_id VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          role VARCHAR(64) NOT NULL DEFAULT 'member',
          joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (team_id, user_id),
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 4.3 Team Assignment Set Items Table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS team_assignment_set_items (
          set_id VARCHAR(64) NOT NULL,
          team_id VARCHAR(64) NOT NULL,
          assigned_role VARCHAR(100) NULL,
          PRIMARY KEY (set_id, team_id),
          INDEX idx_team_id (team_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 5. Projects Table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id VARCHAR(64) PRIMARY KEY,
          organization_id VARCHAR(64) NULL,
          association_type ENUM('team', 'individual') NOT NULL DEFAULT 'team',
          team_assignment_set_id VARCHAR(64) NULL,
          document_creation_permission ENUM('creator_only', 'all_members') NOT NULL DEFAULT 'all_members',
          name VARCHAR(255) NOT NULL,
          description TEXT,
          created_by VARCHAR(64) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_organization_id (organization_id),
          INDEX idx_association_type (association_type),
          INDEX idx_team_assignment_set_id (team_assignment_set_id),
          INDEX idx_doc_creation_perm (document_creation_permission)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 5.1 Project Team Assignments Table
      await conn.query(`
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
      `);

      // 5.2 Project Individual Members Table
      await conn.query(`
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
      `);

      // 6. Templates Table
      await conn.query(`
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
      `);

      // 7. Documents Table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          project_id VARCHAR(64) NULL,
          organization_id VARCHAR(64) NULL,
          template_id VARCHAR(64) NOT NULL,
          template_title VARCHAR(255) NOT NULL,
          document_type ENUM('personal', 'project_shared') NOT NULL DEFAULT 'project_shared',
          is_submittable BOOLEAN NOT NULL DEFAULT FALSE,
          copied_from_id VARCHAR(64) NULL,
          assigned_team_id VARCHAR(64) NULL,
          status ENUM('draft', 'in_review', 'submitted', 'approved', 'published') NOT NULL DEFAULT 'draft',
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
          INDEX idx_copied_from_id (copied_from_id),
          INDEX idx_assigned_team_id (assigned_team_id),
          INDEX idx_status (status),
          INDEX idx_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 7.1 Document Submissions Table
      await conn.query(`
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
      `);

      // 7.2 Submission Comments Table
      await conn.query(`
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
      `);

      // Column migrations for pre-existing tables if any
      try {
        await conn.query(`ALTER TABLE \`organization_members\` MODIFY COLUMN role ENUM('owner', 'manager', 'member') NOT NULL DEFAULT 'member'`);
      } catch {
        // ignore
      }
      try {
        await conn.query(`ALTER TABLE \`projects\` MODIFY COLUMN organization_id VARCHAR(64) NULL`);
      } catch {
        // ignore
      }
      try {
        await conn.query(`ALTER TABLE \`documents\` MODIFY COLUMN status ENUM('draft', 'in_review', 'submitted', 'approved', 'published') NOT NULL DEFAULT 'draft'`);
      } catch {
        // ignore
      }

      await ensureColumnExists(conn, 'users', 'is_verified', 'BOOLEAN NOT NULL DEFAULT FALSE');

      await ensureColumnExists(conn, 'projects', 'association_type', "ENUM('team', 'individual') NOT NULL DEFAULT 'team'");
      await ensureColumnExists(conn, 'projects', 'team_assignment_set_id', 'VARCHAR(64) NULL');
      await ensureColumnExists(conn, 'projects', 'document_creation_permission', "ENUM('creator_only', 'all_members') NOT NULL DEFAULT 'all_members'");
      await ensureColumnExists(conn, 'organization_teams', 'set_id', 'VARCHAR(64) NULL');

      await ensureColumnExists(conn, 'templates', 'visibility', "ENUM('private', 'public') NOT NULL DEFAULT 'private'");
      await ensureColumnExists(conn, 'templates', 'organization_id', 'VARCHAR(64) NULL');
      await ensureColumnExists(conn, 'templates', 'created_by', 'VARCHAR(64) NULL');
      await ensureColumnExists(conn, 'templates', 'tags', 'JSON NULL');

      await ensureColumnExists(conn, 'documents', 'project_id', 'VARCHAR(64) NULL');
      await ensureColumnExists(conn, 'documents', 'organization_id', 'VARCHAR(64) NULL');
      await ensureColumnExists(conn, 'documents', 'created_by', 'VARCHAR(64) NULL');
      await ensureColumnExists(conn, 'documents', 'last_edited_by', 'VARCHAR(64) NULL');
      await ensureColumnExists(conn, 'documents', 'document_type', "ENUM('personal', 'project_shared') NOT NULL DEFAULT 'project_shared'");
      await ensureColumnExists(conn, 'documents', 'is_submittable', 'BOOLEAN NOT NULL DEFAULT FALSE');
      await ensureColumnExists(conn, 'documents', 'copied_from_id', 'VARCHAR(64) NULL');
      await ensureColumnExists(conn, 'documents', 'assigned_team_id', 'VARCHAR(64) NULL');

      // Auto-repair: Enforce that documents under projects with individual association are strictly personal
      try {
        await conn.query(`
          UPDATE documents d
          JOIN projects p ON d.project_id = p.id
          SET d.document_type = 'personal'
          WHERE p.association_type = 'individual' AND d.document_type != 'personal'
        `);
      } catch {
        // ignore if tables not yet populated
      }

      // Seed config demo users, organizations, projects, and templates
      await seedConfigData(conn);
      await seedDefaultTemplates(conn);

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

export function loadDefaultConfig(): any {
  const possiblePaths = [
    path.join(__dirname, '../config/default-config.json'),
    path.join(__dirname, '../../config/default-config.json'),
    path.join(process.cwd(), 'config/default-config.json'),
    path.join(process.cwd(), 'src/backend/config/default-config.json'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(raw);
      } catch (err: any) {
        console.warn(`[Config] Failed to parse ${configPath}:`, err.message);
      }
    }
  }

  // Fallback in-memory default config
  return {
    demoUsers: [
      {
        id: 'usr-demo-organizer',
        username: 'demo_organizer',
        email: 'organizer@docforge.local',
        password: 'Password123!',
        name: 'Demo Organizer',
        user_type: 'organizer',
      },
      {
        id: 'usr-demo-regular',
        username: 'demo_regular',
        email: 'regular@docforge.local',
        password: 'Password123!',
        name: 'Demo Regular Member',
        user_type: 'regular',
      },
    ],
  };
}

export async function ensureUserPersonalOrganization(
  userId: string,
  username: string,
  name?: string,
  conn?: mysql.PoolConnection | mysql.Pool
): Promise<string> {
  const runner = conn || pool;
  const orgName = `${username}_workspace`;

  // Check if personal organization already exists for this user
  const [existing] = await runner.query<any[]>(
    'SELECT id FROM organizations WHERE name = ? AND created_by = ? LIMIT 1',
    [orgName, userId]
  );

  let orgId: string;
  if (existing && existing.length > 0) {
    orgId = existing[0].id;
  } else {
    orgId = `ws-${crypto.randomBytes(4).toString('hex')}`;
    const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const joinCode = `WS-${randomCode}`;
    const description = `Personal private workspace for ${name || username}`;

    await runner.query(
      `INSERT INTO organizations (id, name, description, join_code, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [orgId, orgName, description, joinCode, userId]
    );
  }

  // Ensure member record exists as owner
  await runner.query(
    `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
     VALUES (?, ?, 'owner', NOW())
     ON DUPLICATE KEY UPDATE role = 'owner'`,
    [orgId, userId]
  );

  // Retroactively associate standalone personal documents (where organization_id IS NULL and project_id IS NULL)
  // to the user's personal private workspace
  try {
    await runner.query(
      `UPDATE documents
       SET organization_id = ?
       WHERE created_by = ? AND organization_id IS NULL AND project_id IS NULL`,
      [orgId, userId]
    );
  } catch {
    // Non-fatal
  }

  // Retroactively associate unassigned personal projects to the user's personal private workspace
  try {
    await runner.query(
      `UPDATE projects
       SET organization_id = ?
       WHERE created_by = ? AND organization_id IS NULL`,
      [orgId, userId]
    );
  } catch {
    // Non-fatal
  }

  return orgId;
}

export async function seedConfigData(conn?: mysql.PoolConnection): Promise<void> {
  const runner = conn || (await pool.getConnection());
  try {
    const config = loadDefaultConfig();

    // 1. Seed demo users
    if (Array.isArray(config.demoUsers)) {
      for (const u of config.demoUsers) {
        const passwordHash = await bcrypt.hash(u.password || 'Password123!', 10);
        await runner.query(
          `INSERT INTO users (id, username, email, password_hash, name, user_type, is_verified, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             user_type = VALUES(user_type),
             is_verified = TRUE`,
          [u.id, u.username, u.email, passwordHash, u.name, u.user_type || 'regular']
        );

        // Ensure personal private organization for demo user
        await ensureUserPersonalOrganization(u.id, u.username, u.name, runner);
      }
    }

    // 2. Seed default demo organization
    const orgConfig = config.defaultOrganization || config.defaultTeam;
    if (orgConfig) {
      const t = orgConfig;
      const creatorId = config.demoUsers?.[0]?.id || 'usr-demo-organizer';

      await runner.query(
        `INSERT INTO organizations (id, name, description, join_code, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description),
           join_code = VALUES(join_code)`,
        [t.id, t.name, t.description || '', t.join_code || 'ORG-CORE-2026', creatorId]
      );

      // Add organizer as owner
      await runner.query(
        `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
         VALUES (?, ?, 'owner', NOW())
         ON DUPLICATE KEY UPDATE role = 'owner'`,
        [t.id, creatorId]
      );

      // Add regular user as member
      const regularId = config.demoUsers?.[1]?.id;
      if (regularId) {
        await runner.query(
          `INSERT INTO organization_members (organization_id, user_id, role, joined_at)
           VALUES (?, ?, 'member', NOW())
           ON DUPLICATE KEY UPDATE role = 'member'`,
          [t.id, regularId]
        );
      }

      // 3. Seed default project in organization
      if (config.defaultProject) {
        const p = config.defaultProject;
        await runner.query(
          `INSERT INTO projects (id, organization_id, team_assignment_set_id, name, description, created_by, created_at, updated_at)
           VALUES (?, ?, 'set-fullstack-delivery', ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             description = VALUES(description),
             team_assignment_set_id = COALESCE(team_assignment_set_id, 'set-fullstack-delivery')`,
          [p.id, t.id, p.name, p.description || '', creatorId]
        );
      }

      // 4. Seed default Team Assignment Set FIRST (Contains teams)
      const defaultSetId = 'set-fullstack-delivery';
      await runner.query(
        `INSERT INTO team_assignment_sets (id, organization_id, name, description, created_by, created_at, updated_at)
         VALUES (?, ?, 'Full-Stack Web Delivery Set', 'Standard cross-functional pod configuration for web platforms and services.', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description)`,
        [defaultSetId, t.id, creatorId]
      );

      // 4.1 Seed demo teams WITHIN the Team Assignment Set
      const demoTeams = [
        {
          id: 'team-core-eng',
          name: 'Core Engineering & Architecture',
          description: 'System architecture, core data modeling, and performance standards.',
        },
        {
          id: 'team-web-ui',
          name: 'Frontend Experience Squad',
          description: 'React design system, dynamic template editor components, and UX workflows.',
        },
        {
          id: 'team-api-cloud',
          name: 'Cloud & Microservices Squad',
          description: 'RESTful API routing, JWT authentication, Docker orchestration, and CI/CD.',
        },
      ];

      for (const tm of demoTeams) {
        await runner.query(
          `INSERT INTO organization_teams (id, organization_id, set_id, name, description, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             set_id = COALESCE(set_id, VALUES(set_id)),
             name = VALUES(name),
             description = VALUES(description)`,
          [tm.id, t.id, defaultSetId, tm.name, tm.description, creatorId]
        );
      }

      // Seed team members (users within the organization assigned to squads)
      await runner.query(
        `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
         VALUES ('team-core-eng', ?, 'lead', NOW())
         ON DUPLICATE KEY UPDATE role = 'lead'`,
        [creatorId]
      );
      if (regularId) {
        await runner.query(
          `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
           VALUES ('team-core-eng', ?, 'member', NOW())
           ON DUPLICATE KEY UPDATE role = 'member'`,
          [regularId]
        );
        await runner.query(
          `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
           VALUES ('team-web-ui', ?, 'lead', NOW())
           ON DUPLICATE KEY UPDATE role = 'lead'`,
          [regularId]
        );
      }
      await runner.query(
        `INSERT INTO organization_team_members (team_id, user_id, role, joined_at)
         VALUES ('team-api-cloud', ?, 'lead', NOW())
         ON DUPLICATE KEY UPDATE role = 'lead'`,
        [creatorId]
      );

      // Seed items in default Team Assignment Set for referential mapping
      const setItems = [
        { teamId: 'team-core-eng', role: 'Architecture & System Design' },
        { teamId: 'team-web-ui', role: 'Frontend UI/UX' },
        { teamId: 'team-api-cloud', role: 'Backend API & Cloud' },
      ];
      for (const item of setItems) {
        await runner.query(
          `INSERT INTO team_assignment_set_items (set_id, team_id, assigned_role)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE assigned_role = VALUES(assigned_role)`,
          [defaultSetId, item.teamId, item.role]
        );
      }

      // Seed project team assignments for default project
      if (config.defaultProject) {
        for (const item of setItems) {
          const assignId = `pta-${config.defaultProject.id}-${item.teamId}`;
          await runner.query(
            `INSERT INTO project_team_assignments (id, project_id, team_id, assigned_role, assigned_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE assigned_role = VALUES(assigned_role)`,
            [assignId, config.defaultProject.id, item.teamId, item.role]
          );
        }
      }
    }

    // Retroactively ensure personal private organizations for all existing users in database
    try {
      const [allDbUsers] = await runner.query<any[]>('SELECT id, username, name FROM users');
      if (Array.isArray(allDbUsers)) {
        for (const dbUser of allDbUsers) {
          await ensureUserPersonalOrganization(dbUser.id, dbUser.username, dbUser.name, runner);
        }
      }
    } catch (err: any) {
      console.warn('[Database] Notice checking existing users for personal workspaces:', err.message);
    }

    console.log('[Database] Demo users, default organization, teams, assignment sets, and project verified and seeded.');
  } finally {
    if (!conn) {
      runner.release();
    }
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
        level: 1,
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
        level: 1,
        placeholder: '- Low latency (<10ms)\n- Zero vendor lock-in',
        default_value: '- High availability and low latency (<10ms)\n- Clean separation of concerns (Host Nginx -> Container Nginx -> NodeJS -> MySQL)\n- Developer velocity and fast onboarding',
        required: false,
        order: 1,
        options: null,
      },
      {
        id: 'considered_options',
        label: '3. Considered Options',
        description: 'Evaluated architectural alternatives. Each item contains a description (key) and editable value.',
        view_markdown: '> **Reviewer Guidance**: Evaluate each architecture alternative thoroughly against operational cost and team velocity.',
        field_type: 'repeatable_list',
        level: 1,
        placeholder: 'Click + to add an option',
        default_value: [
          {
            id: 'opt-1',
            description: 'Option A: Managed Cloud Service',
            value: '- Pros: Zero infrastructure maintenance\n- Cons: High monthly cost, vendor lock-in',
            title: 'Option A: Managed Cloud Service',
            content: '- Pros: Zero infrastructure maintenance\n- Cons: High monthly cost, vendor lock-in',
          },
          {
            id: 'opt-2',
            description: 'Option B: Self-Hosted Docker Container Tier',
            value: '- Pros: Complete control, portable across developer laptops and cloud\n- Cons: Requires Docker Compose orchestration',
            title: 'Option B: Self-Hosted Docker Container Tier',
            content: '- Pros: Complete control, portable across developer laptops and cloud\n- Cons: Requires Docker Compose orchestration',
          },
        ],
        required: true,
        order: 2,
        options: null,
      },
      {
        id: 'decision_outcome',
        label: '4. Decision Outcome',
        description: 'The chosen solution and key justification.',
        field_type: 'markdown',
        level: 1,
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
        level: 1,
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
        level: 1,
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
        label: '1. Executive Summary',
        description: 'High-level summary of what this feature delivers.',
        field_type: 'markdown',
        level: 1,
        placeholder: 'Brief overview...',
        default_value: 'This feature introduces [Feature Name] to empower users to [Primary Benefit].',
        required: true,
        order: 0,
        options: null,
      },
      {
        id: 'target_audience',
        label: '2. Target Personas & Users',
        description: 'Target users and pain points.',
        field_type: 'markdown',
        level: 1,
        placeholder: 'Personas...',
        default_value: '- **Primary Persona**: Software Engineer / Architect\n- **Secondary Persona**: Product Manager / Technical Writer',
        required: true,
        order: 1,
        options: null,
      },
      {
        id: 'user_stories',
        label: '3. User Stories & Acceptance Criteria',
        description: 'User story format: As a [user], I want [capability] so that [benefit]. Click "+" to add stories.',
        field_type: 'repeatable_list',
        level: 1,
        placeholder: 'Click + to add user stories',
        default_value: [
          {
            id: 'us-1',
            title: 'User Story 1: Template Hierarchy',
            content: 'As an architect, I want to define element levels in the template builder so that documents follow a structured outline.',
          },
          {
            id: 'us-2',
            title: 'User Story 2: On-the-Fly Document Items',
            content: 'As an author, I want a "+" button in the editor to add extra items dynamically while writing without altering the base template.',
          },
        ],
        required: true,
        order: 2,
        options: null,
      },
      {
        id: 'functional_specs',
        label: '4. Functional Specifications',
        description: 'Detailed functional requirements.',
        field_type: 'markdown',
        level: 1,
        placeholder: 'Functional specs...',
        default_value: '- [FR-1] Template builder supports reordering, levels, and repeatable list items.\n- [FR-2] Document editor auto-generates fields from template items with "+" button.\n- [FR-3] Preview mode renders clean markdown and offers copy/download .md.',
        required: true,
        order: 3,
        options: null,
      },
      {
        id: 'milestones',
        label: '5. Release Criteria & Milestones',
        description: 'Checklist for release readiness.',
        field_type: 'checklist',
        level: 1,
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
        label: '1. Incident Brief',
        description: 'One-line overview of the outage or failure.',
        field_type: 'short_text',
        level: 1,
        placeholder: 'e.g. Database connection pool exhaustion during peak load',
        default_value: 'Service disruption in API Gateway during morning peak',
        required: true,
        order: 0,
        options: null,
      },
      {
        id: 'severity',
        label: '2. Severity Level',
        description: 'Incident classification tier.',
        field_type: 'select',
        level: 1,
        placeholder: 'Select severity',
        default_value: 'P1 - High',
        required: true,
        order: 1,
        options: ['P0 - Critical (Outage)', 'P1 - High (Degraded)', 'P2 - Medium (Minor)', 'P3 - Low'],
      },
      {
        id: 'impact_summary',
        label: '3. User Impact & Timeline',
        description: 'Chronological timeline from detection to resolution.',
        field_type: 'markdown',
        level: 1,
        placeholder: 'Timeline of events...',
        default_value: '- **14:02 UTC**: Elevated 500 error alert triggered\n- **14:05 UTC**: On-call engineer paged\n- **14:15 UTC**: Root cause identified and hotfix deployed\n- **14:22 UTC**: Full traffic restored',
        required: true,
        order: 2,
        options: null,
      },
      {
        id: 'root_cause',
        label: '4. Root Cause Analysis',
        description: 'Deep dive into underlying causes and contributing factors.',
        field_type: 'markdown',
        level: 1,
        placeholder: 'Why did it fail?',
        default_value: 'Unindexed query triggered a full table scan, holding table locks and exhausting backend worker threads.',
        required: true,
        order: 3,
        options: null,
      },
      {
        id: 'investigation_iterations',
        label: '5. Root Cause & Investigation Iterations',
        description: 'Document debugging iterations. Each iteration groups Reason (hypothesis), Todo (action taken), and Response (findings).',
        view_markdown: '> **Postmortem Guidance**: Record each cycle of investigative troubleshooting to trace the debugging process.',
        field_type: 'iteration_group',
        level: 1,
        placeholder: 'Click + Add Iteration to log an investigation cycle',
        iteration_fields: [
          { key: 'Reason', description: 'Hypothesis or symptom investigated', placeholder: 'Enter reason or hypothesis...' },
          { key: 'Todo', description: 'Action item or diagnostic command executed', placeholder: 'Enter investigative action...' },
          { key: 'Response', description: 'Observed outcome or diagnostic finding', placeholder: 'Enter observed response...' },
        ],
        default_value: [
          {
            id: 'iter-1',
            iteration_number: 1,
            title: 'Iteration #1',
            values: {
              Reason: 'High 500 error rate observed on API gateway',
              Todo: 'Check upstream microservice latency metrics and thread pool health',
              Response: 'Auth service latency spike correlated with peak traffic window',
            },
          },
          {
            id: 'iter-2',
            iteration_number: 2,
            title: 'Iteration #2',
            values: {
              Reason: 'Auth service connection pool saturation suspected',
              Todo: 'Inspect database slow query log and active thread count',
              Response: 'Unindexed query on user sessions table holding row locks',
            },
          },
        ],
        required: false,
        order: 4,
        options: null,
      },
      {
        id: 'action_items',
        label: '6. Action Items & Remediation Roadmap',
        description: 'Remediation tasks. Click "+" to add specific remediation items.',
        field_type: 'repeatable_list',
        level: 1,
        placeholder: 'Click + to add action items',
        default_value: [
          {
            id: 'act-1',
            title: 'Action 1: Database Query Optimization',
            content: 'Add composite index on `(user_id, status)` and set max execution time to 3000ms.',
          },
          {
            id: 'act-2',
            title: 'Action 2: Worker Connection Pool Resizing',
            content: 'Increase pool connection limit from 10 to 25 and configure circuit breaker pattern.',
          },
        ],
        required: true,
        order: 5,
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
        visibility: 'public',
        tags: ['architecture', 'adr', 'decision', 'system-design'],
        elements: seedAdrElements,
      },
      {
        id: 'tpl-prd',
        title: 'Product Requirement Document (PRD)',
        description: 'Define product purpose, target audience, functional specifications, and release milestones.',
        category: 'Product',
        icon: 'file-text',
        visibility: 'public',
        tags: ['product', 'prd', 'specification', 'requirements'],
        elements: seedPrdElements,
      },
      {
        id: 'tpl-postmortem',
        title: 'Incident Postmortem Report',
        description: 'Blameless postmortem analysis for tracking outages, root causes, and remediation roadmap.',
        category: 'Operations',
        icon: 'shield-alert',
        visibility: 'public',
        tags: ['operations', 'postmortem', 'incident', 'sre'],
        elements: seedPostmortemElements,
      },
    ];

    for (const t of templatesToSeed) {
      await runner.query(
        `INSERT INTO templates (id, title, description, category, icon, visibility, organization_id, created_by, tags, document_elements, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 'usr-demo-organizer', ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE 
           title = VALUES(title),
           description = VALUES(description),
           category = VALUES(category),
           icon = VALUES(icon),
           visibility = VALUES(visibility),
           tags = VALUES(tags),
           document_elements = VALUES(document_elements),
           updated_at = NOW()`,
        [t.id, t.title, t.description, t.category, t.icon, t.visibility, JSON.stringify(t.tags), JSON.stringify(t.elements)]
      );
    }
  } finally {
    if (!conn) {
      runner.release();
    }
  }
}
