import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { createServer } from "http";
import admin from 'firebase-admin';
import path from "path";
import fs from "fs";

// Minimal serverless-friendly index
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                           process.env.SERVICE_ACCOUNT_PATH || 
                           path.join(process.cwd(), 'betting-at-developers-smc-firebase-adminsdk-fbsvc-9145d29124.json');

if (admin.apps.length === 0) {
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com",
      });
    } catch (err) {
      admin.initializeApp({ databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com" });
    }
  } else {
    admin.initializeApp({ databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com" });
  }
}

const httpServer = createServer(app);

export default async (req: Request, res: Response) => {
  await registerRoutes(httpServer, app);
  
  // In serverless, we don't use httpServer.listen()
  // Express app can handle the request directly
  return app(req, res);
};
