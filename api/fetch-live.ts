import { type Request, Response } from "express";
import admin from 'firebase-admin';
import path from "path";
import fs from "fs";
import { fetchAndStoreLiveMatches } from "../server/liveMatches";

const serviceAccountPath = path.join(process.cwd(), 'betting-at-developers-smc-firebase-adminsdk-fbsvc-9145d29124.json');

if (admin.apps.length === 0) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com",
    });
  } catch (err) {
    admin.initializeApp({ databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com" });
  }
}

const db = admin.database();

export default async (req: Request, res: Response) => {
  try {
    const processed = await fetchAndStoreLiveMatches(db as any);
    return res.status(200).json({ status: "success", processed });
  } catch (error: any) {
    console.error("Live match fetch error:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};
