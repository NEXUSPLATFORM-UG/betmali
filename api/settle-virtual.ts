import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { runBackgroundSettlement } from '../server/settlement';

function initFirebaseFromEnv() {
  if (admin.apps.length > 0) return admin;

  const svcEnv = process.env.SERVICE_ACCOUNT_JSON || process.env.SERVICE_ACCOUNT_BASE64;

  // If env provided, try that first
  if (svcEnv) {
    try {
      let raw = svcEnv;
      // Try parse directly; if it fails assume base64
      let obj;
      try {
        obj = JSON.parse(raw);
      } catch (e) {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        obj = JSON.parse(decoded);
      }

      admin.initializeApp({
        credential: admin.credential.cert(obj as any),
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://betting-at-developers-smc-default-rtdb.firebaseio.com',
      });
      console.log('Firebase Admin initialized from SERVICE_ACCOUNT_JSON env');
      return admin;
    } catch (err) {
      console.error('Failed to init Firebase from SERVICE_ACCOUNT_JSON:', err);
    }
  }

  // Next fallback: try repo-local service account file
  const repoSaPath = path.join(process.cwd(), 'betting-at-developers-smc-firebase-adminsdk-fbsvc-9145d29124.json');
  if (fs.existsSync(repoSaPath)) {
    try {
      const raw = fs.readFileSync(repoSaPath, 'utf8');
      const obj = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(obj as any),
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://betting-at-developers-smc-default-rtdb.firebaseio.com',
      });
      console.log('Firebase Admin initialized from repo-local service account file');
      return admin;
    } catch (err) {
      console.error('Failed to init Firebase from repo-local service account file:', err);
    }
  }

  // Fallback to default initialization (e.g., GOOGLE_APPLICATION_CREDENTIALS)
  try {
    admin.initializeApp({
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://betting-at-developers-smc-default-rtdb.firebaseio.com',
    });
    console.log('Firebase Admin initialized with default credentials');
    return admin;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err);
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Accept ADMIN_TOKEN from env, or fallback to repo-local `admin_token.txt` for zero-config
  let adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    const tpath = path.join(process.cwd(), 'admin_token.txt');
    if (fs.existsSync(tpath)) {
      try { adminToken = fs.readFileSync(tpath, 'utf8').trim(); } catch (e) { /* ignore */ }
    }
  }
  const token = String(req.headers['x-admin-token'] || req.query.token || '');
  if (!adminToken || token !== adminToken) {
    return res.status(403).json({ message: 'forbidden' });
  }

  try {
    const _admin = initFirebaseFromEnv();
    const db = _admin.database();
    const processed = await runBackgroundSettlement(db as any);
    return res.json({ processed });
  } catch (err) {
    console.error('Error running settlement from serverless:', err);
    return res.status(500).json({ message: 'error', error: String(err) });
  }
}
