import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

import { initMongo } from './services/mongodb/mongoClient.js';
import { checkGeminiHealth } from './services/gemini/geminiClient.js';
import { initLocalIndex } from './services/embeddings/vectorIndex.js';
import { apiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 8000;

// Security & performance middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
// Robust CORS configuration:
// If request has origin, allow recognized origins or any origin with proper CORS headers
const ALLOWED_ORIGINS = [
  'https://sih26108-d804d.web.app',
  'https://sih26108-d804d.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) {
      return callback(null, true);
    }
    // For other origins in development or custom domains, reflect origin to allow cross-origin
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Router
app.use('/api', apiRouter);

// Global Error Handler (e.g. Multer limit, JSON parsing)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: "File size exceeds 10MB limit.",
      detail: "Uploaded file is too large. Please upload a tender document under 10MB."
    });
  }
  if (err) {
    console.error("[SERVER] Unhandled error:", err);
    return res.status(err.status || 500).json({
      error: err.message || "Internal server error",
      detail: err.message || "An unexpected error occurred."
    });
  }
  next();
});

// Serve built React frontend if exists, otherwise serve root static files (bis_home.html, etc.)
const clientDist = path.join(ROOT_DIR, 'client', 'dist');
import fs from 'fs';

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  // Serve existing frontend files directly
  app.use(express.static(ROOT_DIR));
  app.get('/', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'bis_home.html'));
  });
}

// Server startup sequence
async function startServer() {
  console.log("============================================================");
  console.log(" BIS AI Procurement Standards Assistant — Node.js Platform");
  console.log(" SIH 2026 / PS 26108");
  console.log("============================================================");

  // 1. Initialize local standards index (in-memory)
  initLocalIndex();

  // 2. Perform non-blocking MongoDB Atlas check
  initMongo().catch(err => {
    console.warn(`[MongoDB] Initialization notice: ${err.message}`);
  });

  // 3. Perform ONE Gemini health check
  checkGeminiHealth().catch(err => {
    console.warn(`[Gemini] Health check notice: ${err.message}`);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[OK] Production Express server active on http://localhost:${PORT}`);
    console.log(`  Frontend:  http://localhost:${PORT}/`);
    console.log(`  Health:    http://localhost:${PORT}/api/health`);
    console.log("============================================================\n");
  });
}

startServer();
