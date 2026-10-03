import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { User, UserType, OrganizationRole, TeamRole } from './models';

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

export async function getOrganizationRole(userId: string, organizationId: string): Promise<OrganizationRole | null> {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT om.role, o.created_by FROM organization_members om JOIN organizations o ON om.organization_id = o.id WHERE om.organization_id = ? AND om.user_id = ?',
      [organizationId, userId]
    );
    if (rows && rows.length > 0) {
      if (rows[0].created_by === userId) {
        return 'owner';
      }
      return rows[0].role as OrganizationRole;
    }
    // Check if user is the organization creator even if member row was missing
    const [orgRows] = await pool.query<any[]>('SELECT created_by FROM organizations WHERE id = ?', [organizationId]);
    if (orgRows && orgRows.length > 0 && orgRows[0].created_by === userId) {
      return 'owner';
    }
    return null;
  } catch (err) {
    return null;
  }
}

export async function isOrganizationCreator(userId: string, organizationId: string): Promise<boolean> {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT created_by FROM organizations WHERE id = ?',
      [organizationId]
    );
    if (rows && rows.length > 0) {
      return rows[0].created_by === userId;
    }
    return false;
  } catch (err) {
    return false;
  }
}

export async function isOrganizationOwner(userId: string, organizationId: string): Promise<boolean> {
  const role = await getOrganizationRole(userId, organizationId);
  return role === 'owner';
}

export async function isOrganizationManager(userId: string, organizationId: string): Promise<boolean> {
  const role = await getOrganizationRole(userId, organizationId);
  return role === 'owner' || role === 'manager';
}

export async function isOrganizationMember(userId: string, organizationId: string): Promise<boolean> {
  const role = await getOrganizationRole(userId, organizationId);
  return role !== null;
}

// Aliases for backwards compatibility
export const isTeamCreator = isOrganizationCreator;
export const getTeamRole = getOrganizationRole;
export const isTeamOwner = isOrganizationOwner;
export const isTeamManager = isOrganizationManager;
export const isTeamMember = isOrganizationMember;
