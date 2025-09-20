import * as admin from 'firebase-admin';
import { HttpError } from './httpError';

export interface AuthContext {
  uid: string;
  token: admin.auth.DecodedIdToken;
}

/** Extract Bearer token from Authorization header */
function extractBearer(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
}

export async function verifyAuth(req: { headers?: any }): Promise<AuthContext> {
  const header = req.headers?.authorization || req.headers?.Authorization;
  const tokenString = extractBearer(typeof header === 'string' ? header : undefined);
  if (!tokenString) {
    throw new HttpError(401, 'Missing or invalid Authorization header');
  }
  try {
    const decoded = await admin.auth().verifyIdToken(tokenString, true);
    return { uid: decoded.uid, token: decoded };
  } catch (e: any) {
    throw new HttpError(401, 'Invalid or expired token');
  }
}
