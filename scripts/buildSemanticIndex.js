/**
 * Offline Semantic Index Builder
 * ISRA — Indian Standards Retrieval Architecture
 *
 * Precomputes semantic vectors, concept embeddings, and search representations
 * for all local verified standards and persists them into data/semantic_index.json.
 * Run via: npm run build:index
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildDocumentSemanticText,
  computeConceptVector
} from '../server/services/embeddings/semanticEngine.js';
import { buildStandardText, normalize } from '../server/services/embeddings/vectorIndex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const LOCAL_STANDARDS_PATH = path.join(DATA_DIR, 'local_standards.json');
const OUTPUT_INDEX_PATH = path.join(DATA_DIR, 'semantic_index.json');

export function buildIndex() {
  console.log('================================================================================');
  console.log(' ISRA — BUILDING OFFLINE SEMANTIC & VECTOR INDEX');
  console.log('================================================================================');

  if (!fs.existsSync(LOCAL_STANDARDS_PATH)) {
    console.error(`[Error] Standards source file not found at: ${LOCAL_STANDARDS_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(LOCAL_STANDARDS_PATH, 'utf-8');
  const standards = JSON.parse(raw);

  console.log(`Loaded ${standards.length} Indian Standards from local_standards.json`);

  const indexedStandards = [];

  for (const std of standards) {
    const semanticText = buildDocumentSemanticText(std);
    const conceptVec = Array.from(computeConceptVector(semanticText));
    const searchText = buildStandardText(std);

    indexedStandards.push({
      ...std,
      _semantic_text: semanticText,
      _concept_vector: conceptVec,
      _search_text: searchText,
      _norm_title: normalize(std.title || "")
    });

    console.log(`  [Indexed] ${std.is_number.padEnd(28)} | ${(std.title || "").slice(0, 45)}`);
  }

  fs.writeFileSync(OUTPUT_INDEX_PATH, JSON.stringify(indexedStandards, null, 2), 'utf-8');

  console.log('\n================================================================================');
  console.log(` SUCCESS: Indexed ${indexedStandards.length} standards -> ${OUTPUT_INDEX_PATH}`);
  console.log('================================================================================\n');
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildIndex();
}
