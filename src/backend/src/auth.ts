import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { User, UserType, TeamRole } from './models';

const JWT_SECRET = process.env.JWT_SECRET || 'docforge-jwt-secret-key-2026-prod';

export interface AuthPayload {
  id: string;
  username: string;
  email: string;
  name: string;
  user_type: UserType;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: User | AuthPayload): string {
  const payload: AuthPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    user_type: user.user_type,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }

  req.user = payload;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

export async function getTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT tm.role, t.created_by FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE tm.team_id = ? AND tm.user_id = ?',
      [teamId, userId]
    );
    if (rows && rows.length > 0) {
      if (rows[0].created_by === userId) {
        return 'owner';
      }
      return rows[0].role as TeamRole;
    }
    // Check if user is the team creator even if member row was missing
    const [teamRows] = await pool.query<any[]>('SELECT created_by FROM teams WHERE id = ?', [teamId]);
    if (teamRows && teamRows.length > 0 && teamRows[0].created_by === userId) {
      return 'owner';
    }
    return null;
  } catch (err) {
    return null;
  }
}

export async function isTeamOwner(userId: string, teamId: string): Promise<boolean> {
  const role = await getTeamRole(userId, teamId);
  return role === 'owner';
}

export async function isTeamManager(userId: string, teamId: string): Promise<boolean> {
  const role = await getTeamRole(userId, teamId);
  return role === 'owner' || role === 'manager';
}

export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const role = await getTeamRole(userId, teamId);
  return role !== null;
}
