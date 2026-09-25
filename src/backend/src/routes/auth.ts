import { Router, Response } from 'express';
import crypto from 'crypto';
import { pool, loadDefaultConfig } from '../db';
import {
  AuthenticatedRequest,
  comparePassword,
  generateToken,
  hashPassword,
  requireAuth,
} from '../auth';
import { User, UserType } from '../models';

export const authRouter = Router();

function formatUserRow(row: any): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    user_type: row.user_type as UserType,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// POST /api/v1/auth/register
authRouter.post('/register', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, password, name, user_type } = req.body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name && typeof name === 'string' && name.trim()) || cleanUsername;
    const cleanUserType: UserType = user_type === 'organizer' ? 'organizer' : 'regular';

    // Check if username or email already exists
    const [existing] = await pool.query<any[]>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [cleanUsername, cleanEmail]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Username or email is already registered' });
    }

    const id = `usr-${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = await hashPassword(password);

    await pool.query(
      `INSERT INTO users (id, username, email, password_hash, name, user_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, cleanUsername, cleanEmail, passwordHash, cleanName, cleanUserType]
    );

    const [rows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ?', [id]);
    const user = formatUserRow(rows[0]);
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to register user', detail: err.message });
  }
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const queryTarget = String(usernameOrEmail).trim().toLowerCase();
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?',
      [queryTarget, queryTarget]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const userRow = rows[0];
    const passwordValid = await comparePassword(password, userRow.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const user = formatUserRow(userRow);
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// GET /api/v1/auth/me
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [userRows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = formatUserRow(userRows[0]);

    // Fetch user's teams
    const [teamRows] = await pool.query<any[]>(
      `SELECT t.*, 
        CASE WHEN t.created_by = ? THEN 'owner' ELSE tm.role END as user_role,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as members_count
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = ?
       ORDER BY t.created_at ASC`,
      [userId, userId]
    );

    const teams = teamRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      join_code: row.join_code,
      created_by: row.created_by,
      user_role: row.user_role,
      members_count: Number(row.members_count || 0),
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    }));

    res.json({
      user,
      teams,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve profile', detail: err.message });
  }
});

// PUT /api/v1/auth/profile
authRouter.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, email, user_type } = req.body;

    const [existingRows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const current = existingRows[0];
    const newName = name !== undefined && typeof name === 'string' ? name.trim() : current.name;
    const newEmail = email !== undefined && typeof email === 'string' ? email.trim().toLowerCase() : current.email;

    let newUserType = current.user_type;
    if (user_type === 'organizer' || user_type === 'regular') {
      newUserType = user_type;
    }

    // Check email conflict if email changed
    if (newEmail !== current.email) {
      const [emailConflict] = await pool.query<any[]>(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [newEmail, userId]
      );
      if (emailConflict && emailConflict.length > 0) {
        return res.status(409).json({ error: 'Email address is already in use by another account' });
      }
    }

    await pool.query(
      `UPDATE users 
       SET name = ?, email = ?, user_type = ?, updated_at = NOW()
       WHERE id = ?`,
      [newName, newEmail, newUserType, userId]
    );

    const [updatedRows] = await pool.query<any[]>('SELECT * FROM users WHERE id = ?', [userId]);
    const updatedUser = formatUserRow(updatedRows[0]);
    const token = generateToken(updatedUser);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update profile', detail: err.message });
  }
});

// GET /api/v1/auth/users (search users to invite)
authRouter.get('/users', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    let sql = 'SELECT id, username, email, name, user_type, created_at, updated_at FROM users';
    const params: any[] = [];

    if (query) {
      sql += ' WHERE LOWER(username) LIKE ? OR LOWER(email) LIKE ? OR LOWER(name) LIKE ?';
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }

    sql += ' ORDER BY name ASC LIMIT 20';
    const [rows] = await pool.query<any[]>(sql, params);
    res.json(rows.map(formatUserRow));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to search users', detail: err.message });
  }
});

// GET /api/v1/auth/demo-users (Public list of configured demo accounts for UI quick-login)
authRouter.get('/demo-users', (req: AuthenticatedRequest, res: Response) => {
  const config = loadDefaultConfig();
  const demoUsers = (config.demoUsers || []).map((u: any) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    password: u.password,
    user_type: u.user_type,
  }));
  res.json(demoUsers);
});
