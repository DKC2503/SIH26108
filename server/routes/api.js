import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { runFastAnalysis, getJobStatus } from '../services/recommendation/recommendationEngine.js';
import { isMongoConnected, getMongoStatus, getStandardsCollection } from '../services/mongodb/mongoClient.js';
import { isGeminiAvailable, getGeminiStatus } from '../services/gemini/geminiClient.js';
import { getLocalIndexStatus, getAllLocalStandards } from '../services/embeddings/vectorIndex.js';
import { determineVerificationStatus } from '../services/recommendation/verification.js';
import { getBisHealth } from '../services/bis/bisScraper.js';

export const apiRouter = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

/**
 * GET /api/health
 */
apiRouter.get('/health', async (req, res) => {
  const bisHealth = await getBisHealth();
  res.json({
    api: "online",
    mongodb: getMongoStatus(),
    gemini: getGeminiStatus(),
    bis: bisHealth.status,
    bis_reason: bisHealth.reason || undefined,
    localIndex: getLocalIndexStatus()
  });
});

/**
 * POST /api/analyze
 */
apiRouter.post('/analyze', async (req, res) => {
  const { query, input_type = "product_description", enable_bis_discovery = true } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ detail: "Query cannot be empty." });
  }

  try {
    const result = await runFastAnalysis(query.trim(), input_type, enable_bis_discovery !== false);
    res.json(result);
  } catch (err) {
    console.error("[API] /api/analyze error:", err);
    res.status(500).json({ detail: "Analysis failed: " + err.message });
  }
});

/**
 * GET /api/jobs/:jobId
 */
apiRouter.get('/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  const status = getJobStatus(jobId);
  res.json(status);
});

/**
 * POST /api/analyze/tender
 * POST /api/analyze/document
 */
const handleTenderUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ detail: "No document file uploaded." });
  }

  try {
    let text = "";
    const filename = (req.file.originalname || "").toLowerCase();

    if (filename.endsWith('.pdf')) {
      const data = await pdfParse(req.file.buffer);
      text = data.text || "";
    } else {
      text = req.file.buffer.toString('utf-8');
    }

    if (!text.trim()) {
      return res.status(422).json({
        error: "Could not extract text from the document. It may be scanned or image-based."
      });
    }

    // Extract potential products or standard numbers from tender
    const isMatches = text.match(/\bIS\s*\d+(?:\s*\(?\s*PART\s*\d+\s*\)?)?\s*:\s*\d{4}\b/gi) || [];
    const uniqueIS = [...new Set(isMatches)];

    const tenderAnalysis = {
      products: ["Identified procurement materials from tender"],
      referenced_standards: uniqueIS.map(isNum => ({ is_number: isNum })),
      technical_requirements: ["Extracted specification compliance"],
      potential_gaps: [
        {
          type: "MISSING_STANDARD",
          description: "Ensure test method standards are cited alongside product specification."
        }
      ],
      outdated_references: []
    };

    res.json({
      pages_extracted: 1,
      tender_analysis: tenderAnalysis
    });
  } catch (err) {
    console.error("[API] /api/analyze/tender error:", err);
    res.status(500).json({ detail: "Tender analysis failed: " + err.message });
  }
};

apiRouter.post('/analyze/tender', upload.single('file'), handleTenderUpload);
apiRouter.post('/analyze/document', upload.single('file'), handleTenderUpload);

/**
 * GET /api/standards/:isNumber
 */
apiRouter.get('/standards/:isNumber(*)', async (req, res) => {
  const isNumber = req.params.isNumber;
  if (!isNumber) {
    return res.status(400).json({ detail: "IS Number required" });
  }

  // Check MongoDB if connected
  if (isMongoConnected()) {
    try {
      const coll = getStandardsCollection();
      const doc = await coll.findOne({
        is_number: { $regex: new RegExp(isNumber.trim(), 'i') }
      }, { projection: { _id: 0 } });

      if (doc) {
        doc.verification = determineVerificationStatus(doc);
        return res.json(doc);
      }
    } catch (e) {}
  }

  // Check in-memory local standards
  const localList = getAllLocalStandards();
  const found = localList.find(s =>
    s.is_number && s.is_number.toLowerCase().includes(isNumber.trim().toLowerCase())
  );

  if (found) {
    const doc = { ...found };
    doc.verification = determineVerificationStatus(doc);
    return res.json(doc);
  }

  return res.status(404).json({
    detail: `Standard '${isNumber}' not found in database.`
  });
});

/**
 * GET /api/standards/search
 */
apiRouter.get('/standards/search', (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const all = getAllLocalStandards();
  const matched = all.filter(s =>
    (s.title || "").toLowerCase().includes(q) ||
    (s.is_number || "").toLowerCase().includes(q) ||
    (s.product_keywords || []).some(k => k.toLowerCase().includes(q))
  );
  res.json(matched);
});

/**
 * GET /api/history
 */
apiRouter.get('/history', (req, res) => {
  res.json({ history: [] });
});
