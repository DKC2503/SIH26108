# BIS AI — Procurement Standards Recommender
> **SIH 2026 · Problem Statement 26108**
> Enterprise-grade BIS Indian Standards Recommendation & Verification Engine for Public Procurement.

---

## ? Key Architectural Upgrades & Performance
- **Ultra-Fast Sub-Second Response**: Replaced sequential blocking scraping with an in-memory indexed standards engine (< 5ms retrieval, < 1ms parsing, < 3ms total response).
- **Asynchronous BIS Discovery**: Live Playwright BIS portal queries run non-blocking in the background with client polling via `/api/jobs/:jobId`.
- **Zero-Dependency Fallbacks**:
  - **Gemini**: Integrates official `@google/genai` Node.js SDK; if key is missing or invalid, automatically falls back to deterministic rule extraction without throwing or blocking.
  - **MongoDB Atlas**: Fast-fail 3s singleton connection with connection pooling; if Atlas is offline (e.g. TLS/SSL alert or firewall), instantly falls back to local in-memory dataset of official Indian Standards.
- **Production-Ready Full-Stack Node.js**: Express REST API backend with modern React 18 + Vite frontend with real-time pipeline visualizer and standard inspector.

---

## ??? Project Structure
```
+-- client/                     # React 18 + Vite Frontend
¦   +-- src/
¦   ¦   +-- App.jsx            # Interactive Procurement Dashboard
¦   ¦   +-- index.css          # Modern dark-mode UI styling
¦   ¦   +-- main.jsx           # React DOM root entry
¦   +-- index.html
¦   +-- package.json
¦   +-- vite.config.js
+-- data/
¦   +-- local_standards.json   # 12+ Canonical Indian Standards with real BIS metadata
+-- server/                     # Express.js Backend
¦   +-- routes/
¦   ¦   +-- api.js             # REST endpoints (/api/analyze, /api/jobs, etc.)
¦   +-- services/
¦   ¦   +-- bis/bisScraper.js  # Non-blocking Playwright scraper
¦   ¦   +-- embeddings/vectorIndex.js  # In-memory hybrid scoring engine (< 2ms)
¦   ¦   +-- gemini/geminiClient.js     # @google/genai SDK wrapper with startup check
¦   ¦   +-- mongodb/mongoClient.js     # Singleton Mongo client with 3s timeout
¦   ¦   +-- recommendation/            # Core recommendation, parser & verification
¦   +-- index.js               # Main Express server entry point
+-- test_node_pipeline.js      # Automated test runner for canonical queries
+-- package.json               # Root dependencies & build scripts
+-- .env.example               # Environment configuration template
```

---

## ?? Quick Start (Production Node.js)

### 1. Prerequisites
- Node.js v18+ (tested on Node v26)
- npm v9+

### 2. Install Dependencies
```bash
# Install root backend dependencies
npm install

# Install frontend dependencies
npm --prefix client install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional: Add your `GEMINI_API_KEY` or `MONGODB_URI`. Both are optional; the application runs fully offline with zero setup).*

### 4. Build Production Frontend
```bash
npm --prefix client run build
```
This produces optimized production assets in `client/dist`.

### 5. Run the Server
```bash
npm start
```
Open **http://localhost:8000** in your browser.

---

## ?? Running Automated Verification Tests
Run the test suite across the 5 canonical procurement queries:
```bash
node test_node_pipeline.js
```
Expected output:
- `Total Latency: < 10 ms`
- `Stage Timings: < 1-3 ms`
- Verified classification of `IS 3705:2024`, `IS 16102`, `IS 10322`, `IS 12701`, `IS 269`.

---

## ?? API Reference
- `POST /api/analyze`: Fast initial recommendation. Returns primary/allied standards and background BIS job ID.
- `GET /api/jobs/:jobId`: Poll for live background BIS portal discoveries.
- `POST /api/analyze/tender`: Upload Tender PDF or paste technical tender requirements.
- `GET /api/standards/:isNumber`: Inspect detailed standard metadata, amendments, and normative references.
- `GET /api/standards/search?q=...`: Search full catalog of Indian Standards.
- `GET /api/health`: Health status of Gemini, MongoDB Atlas, and in-memory cache.

---

## ??? License
Developed for Smart India Hackathon (SIH 2026) · Problem Statement 26108.
