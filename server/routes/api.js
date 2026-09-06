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
/**
 * Helper to extract plain text from DOCX buffer without external native dependencies
 */
function extractTextFromDocxBuffer(buffer) {
  try {
    const raw = buffer.toString('utf-8');
    // Extract XML text contents inside <w:t>...</w:t> tags
    const matches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (matches && matches.length > 0) {
      return matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
    }
    // Fallback: strip null/control bytes and extract readable ASCII/Unicode text
    const clean = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    const words = clean.match(/[A-Za-z0-9:/.(),-]{2,}/g);
    return words ? words.join(' ') : "";
  } catch (err) {
    return "";
  }
}

/**
 * POST /api/analyze/tender
 * POST /api/analyze/document
 */
const handleTenderUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ detail: "No document file uploaded." });
  }

  const filename = (req.file.originalname || "document").toLowerCase();
  const sizeKb = (req.file.size / 1024).toFixed(1);
  console.log(`[TENDER] Request received: filename='${filename}', size=${sizeKb} KB`);

  try {
    let text = "";

    if (filename.endsWith('.pdf')) {
      const data = await pdfParse(req.file.buffer);
      text = data.text || "";
    } else if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
      text = extractTextFromDocxBuffer(req.file.buffer);
    } else {
      // Default to UTF-8 text (txt, csv, md, etc.)
      text = req.file.buffer.toString('utf-8');
    }

    if (!text || !text.trim()) {
      return res.status(422).json({
        error: "Could not extract readable text from the document. It may be scanned or image-based."
      });
    }

    console.log(`[TENDER] Extracted text length: ${text.length} characters`);

    // 1. Extract referenced IS standards from text
    const isMatches = text.match(/\bIS\s*\d+(?:\s*\(?\s*PART\s*[\d\w\s/-]+\s*\)?)?(?:\s*:\s*\d{4})?\b/gi) || [];
    const uniqueIS = [...new Set(isMatches.map(s => s.trim().toUpperCase().replace(/\s+/g, ' ')))];

    // 2. Identify potential product / procurement scope from title or first lines
    // First check file name
    let candidateQuery = filename.replace(/\.(pdf|docx|doc|txt)$/i, '').replace(/^product\s+/i, '').trim();

    // Look for product mention in first 1000 characters
    const firstSlice = text.slice(0, 1500);
    const scopeMatch = firstSlice.match(/(?:procurement of|supply of|specification for|schedule of requirements for|scope of work for)\s+([^\n\r.]+)/i);
    if (scopeMatch && scopeMatch[1]) {
      candidateQuery = scopeMatch[1].trim();
    } else if (uniqueIS.length > 0 && (!candidateQuery || candidateQuery.length < 3)) {
      candidateQuery = uniqueIS[0];
    }

    // 3. Run requirement and recommendation analysis
    const analysisResult = await runFastAnalysis(candidateQuery || "general procurement", "tender_document", true);

    // 4. Build requirement-to-standard mapping and identify specification gaps
    const referencedStandardsList = uniqueIS.map(isNum => {
      const isClean = isNum.replace(/\s+/g, ' ');
      // Check if found in primary or allied standards
      const inPrimary = (analysisResult.primary_standards || []).find(s => s.is_number.toUpperCase() === isClean);
      const inTest = (analysisResult.allied_standards?.test_methods || []).find(s => s.is_number.toUpperCase() === isClean);

      return {
        is_number: isClean,
        status: (inPrimary || inTest) ? "VERIFIED" : "CITED",
        type: inTest ? "TEST_METHOD" : "PRODUCT_SPECIFICATION",
        clause_evidence: `Standard cited in technical compliance schedule of ${filename}`
      };
    });

    // If no explicit IS cited in document but recommendations were found, link the primary recommendation
    if (referencedStandardsList.length === 0 && (analysisResult.primary_standards || []).length > 0) {
      for (const p of analysisResult.primary_standards) {
        referencedStandardsList.push({
          is_number: p.is_number,
          status: "RECOMMENDED",
          type: "MANDATORY_RECOMMENDATION",
          clause_evidence: `Recommended by BISense for procurement requirement '${analysisResult.requirement?.product || candidateQuery}'`
        });
      }
    }

    // Identify gaps
    const potentialGaps = [];
    const hasTestMethods = referencedStandardsList.some(r => r.type === "TEST_METHOD") ||
      (analysisResult.allied_standards?.test_methods || []).length > 0;

    if (!hasTestMethods) {
      potentialGaps.push({
        type: "MISSING_TEST_METHOD",
        description: "Document specifies product requirements but omits Indian Standard sampling and laboratory test methods."
      });
    }

    if (referencedStandardsList.length === 0) {
      potentialGaps.push({
        type: "MISSING_STANDARD",
        description: "No mandatory Indian Standards cited for the specified procurement items."
      });
    }

    const tenderAnalysis = {
      document_name: req.file.originalname,
      identified_product: analysisResult.requirement?.product || candidateQuery,
      industry: analysisResult.requirement?.industry || "general",
      products: [analysisResult.requirement?.product || candidateQuery],
      referenced_standards: referencedStandardsList,
      primary_recommendations: analysisResult.primary_standards || [],
      allied_standards: analysisResult.allied_standards || {},
      technical_requirements: [
        `Extracted technical specification for ${analysisResult.requirement?.product || candidateQuery}`,
        `Ingress & safety conformity verification`
      ],
      potential_gaps: potentialGaps,
      outdated_references: [],
      compliance_risk: referencedStandardsList.length > 0 ? "LOW_RISK" : "ACTION_REQUIRED"
    };

    res.json({
      pages_extracted: 1,
      tender_analysis: tenderAnalysis,
      recommendation_data: analysisResult
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
