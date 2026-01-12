import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runBackgroundSettlement } from "./settlement";
import { fetchAndStoreLiveMatches } from "./liveMatches";
import fs from "fs";
import path from "path";
import admin from 'firebase-admin';

// Initialize Firebase Admin for background settlement using service account
// Prefer explicit service account JSON via `GOOGLE_APPLICATION_CREDENTIALS` or
// a repo-local file. Fall back to default initialization if not present.
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.SERVICE_ACCOUNT_PATH || path.join(process.cwd(), 'betting-at-developers-smc-firebase-adminsdk-fbsvc-9145d29124.json');

if (admin.apps.length === 0) {
  if (fs.existsSync(serviceAccountPath)) {
    console.log('Service account file found at', serviceAccountPath);
    try {
      const saRaw = fs.readFileSync(serviceAccountPath, { encoding: 'utf8' });
      console.log('Service account file size:', saRaw.length);
      const serviceAccount = JSON.parse(saRaw);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com",
      });
      console.log('Firebase Admin initialized using service account:', serviceAccountPath);
    } catch (err) {
      console.error('Failed to initialize Firebase Admin with service account:', err);
      admin.initializeApp({ databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com" });
    }
  } else {
    console.warn('Service account file not found at', serviceAccountPath, '— falling back to default credentials');
    admin.initializeApp({ databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com" });
  }
}

const db = admin.database();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Poll for results every 60 seconds for background settlement
setInterval(() => runBackgroundSettlement(db), 60000);
// Poll live matches every 30 seconds
setInterval(() => fetchAndStoreLiveMatches(db as any), 30000);

// Allow manual triggering via an admin-only endpoint
app.post("/admin/settle-virtual", async (req, res) => {
  const token = String(req.headers["x-admin-token"] || req.query.token || "");
  // allow ADMIN_TOKEN from env or repo-local admin_token.txt for zero-config
  let adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    const tpath = path.join(process.cwd(), 'admin_token.txt');
    if (fs.existsSync(tpath)) {
      try { adminToken = fs.readFileSync(tpath, 'utf8').trim(); } catch (e) { /* ignore */ }
    }
  }
  if (!adminToken || token !== adminToken) {
    return res.status(403).json({ message: "forbidden" });
  }

  try {
    const processed = await runBackgroundSettlement(db as any);
    return res.json({ processed });
  } catch (err) {
    console.error("Admin settlement error:", err);
    return res.status(500).json({ message: "error" });
  }
});

// Run one settlement pass on startup
runBackgroundSettlement(db as any).catch((e) => console.error(e));

// Run one live matches fetch on startup
fetchAndStoreLiveMatches(db as any).catch((e) => console.error(e));

// Admin endpoint to trigger live fetch manually
app.post("/admin/fetch-live", async (req, res) => {
  const token = String(req.headers["x-admin-token"] || req.query.token || "");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ message: "forbidden" });
  }

  try {
    const processed = await fetchAndStoreLiveMatches(db as any);
    return res.json({ processed });
  } catch (err) {
    console.error("Admin live fetch error:", err);
    return res.status(500).json({ message: "error" });
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);

  const listenOptions: any = {
    port,
    host: "0.0.0.0",
  };

  // `reusePort` is not supported on some platforms (Windows) and will
  // cause the server to throw `ENOTSUP`. Only enable it when not on
  // Windows.
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  httpServer.on("error", (err: any) => {
    console.error("HTTP server error:", err);
  });

  httpServer.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
