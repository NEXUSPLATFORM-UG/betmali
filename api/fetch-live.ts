import type { VercelRequest, VercelResponse } from "@vercel/node";
import admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { fetchAndStoreLiveMatches } from "../server/liveMatches";

const serviceAccountPath = path.join(process.cwd(), "betting-at-developers-smc-firebase-adminsdk-fbsvc-9145d29124.json");

function getDb() {
  if (admin.apps.length === 0) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com",
      });
    } catch (err) {
      admin.initializeApp({ databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com" });
    }
  }
  return admin.database();
}

export default async (req: VercelRequest, res: VercelResponse) => {
  // Check token for security
  let adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    const tpath = path.join(process.cwd(), "admin_token.txt");
    try { adminToken = fs.readFileSync(tpath, "utf8").trim(); } catch (e) { /* ignore */ }
  }
  const token = String(req.headers["x-admin-token"] || req.query.token || "");
  if (!adminToken || token !== adminToken) {
    return res.status(403).json({ message: "forbidden" });
  }

  try {
    const db = getDb();
    const processed = await fetchAndStoreLiveMatches(db as any);
    return res.status(200).json({ status: "success", processed });
  } catch (error: any) {
    console.error("Live match fetch error:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};
