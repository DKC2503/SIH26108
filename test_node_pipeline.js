import { runFastAnalysis } from './server/services/recommendation/recommendationEngine.js';

const canonicalQueries = [
  { q: "wheat", expectedIs: "IS 14864:2000", expectedClassification: "DIRECT_PRODUCT" },
  { q: "cement", expectedIs: "IS 269:2015", expectedClassification: "DIRECT_PRODUCT" },
  { q: "helmet", expectedIs: "IS 2925:1984", expectedClassification: "DIRECT_PRODUCT" },
  { q: "fire extinguisher", expectedIs: "IS 15683:2018", expectedClassification: "DIRECT_PRODUCT" },
  { q: "LED street light", expectedIs: "IS 10322 (Part 5/Sec 3):2012", expectedClassification: "DIRECT_PRODUCT" },
  { q: "high tensile rebar", expectedIs: "IS 1786:2008", expectedClassification: "DIRECT_PRODUCT" },
  { q: "ball point pen", expectedIs: "IS 3705:2024", expectedClassification: "DIRECT_PRODUCT" },
  { q: "water bottle", expectedIs: "IS 17803:2022", expectedClassification: "DIRECT_PRODUCT" },
  { q: "HDPE pipe", expectedIs: "IS 4984:2016", expectedClassification: "DIRECT_PRODUCT" },
  { q: "brick", expectedPrimary: "IS 1077:1992", expectedAllied: "IS 3495 (Parts 1 to 4):2019" },
  { q: "IS 3495:2019", expectedIs: "IS 3495 (Parts 1 to 4):2019", isDirect: true },
  { q: "bread food", expectedProduct: "bread", expectBisQueries: ["bread", "bread products", "bakery products"] },
  { q: "airplane engine", expectNoMatch: true },
  // Semantic conceptual queries
  { q: "protective headgear for construction workers", expectedIs: "IS 2925:1984", expectedClassification: "DIRECT_PRODUCT" },
  { q: "steel bars used to reinforce concrete structures", expectedIs: "IS 1786:2008", expectedClassification: "DIRECT_PRODUCT" },
  { q: "lighting installed along public roads", expectedIs: "IS 10322 (Part 5/Sec 3):2012", expectedClassification: "DIRECT_PRODUCT" },
  { q: "cement used for structural construction", expectedIs: "IS 269:2015", expectedClassification: "DIRECT_PRODUCT" },
  // Multilingual semantic queries (Telugu & Hindi)
  { q: "నిర్మాణ కార్మికుల కోసం రక్షణ హెల్మెట్", expectedIs: "IS 2925:1984", expectedClassification: "DIRECT_PRODUCT" },
  { q: "निर्माण श्रमिकों के लिए सुरक्षा हेलमेट", expectedIs: "IS 2925:1984", expectedClassification: "DIRECT_PRODUCT" },
  // General unseeded products testing live BIS retrieval
  { q: "battery", expectedLiveMatch: true },
  { q: "bread", expectedLiveMatch: true },
  { q: "bun", expectedLiveMatch: true },
  { q: "electrical cable", expectedLiveMatch: true },
  { q: "paint", expectedLiveMatch: true },
  { q: "tiles", expectedLiveMatch: true },
  { q: "paper", expectedLiveMatch: true },
  { q: "milk", expectedLiveMatch: true },
  { q: "steel pipe", expectedLiveMatch: true },
  { q: "furniture", expectedLiveMatch: true },
  { q: "quantum banana toaster", expectNoMatch: true }
];

async function run() {
  console.log("================================================================================");
  console.log(" BIS RECOMMENDATION & VERIFICATION PIPELINE TEST SUITE");
  console.log(" SIH 2026 Problem Statement: 26108");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  for (const item of canonicalQueries) {
    const start = performance.now();
    const isLiveTest = Boolean(item.expectedLiveMatch);
    const result = await runFastAnalysis(item.q, "product_description", isLiveTest);
    const duration = performance.now() - start;

    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`QUERY: "${item.q}" (Time: ${duration.toFixed(2)} ms)`);
    console.log(`  Identified Product : ${result.requirement.product}`);
    console.log(`  Identified Industry: ${result.requirement.industry}`);
    console.log(`  Status             : ${result.status}`);

    const primaryList = result.primary_standards.map(s => s.is_number);
    console.log(`  Primary Standards  : ${primaryList.join(', ') || 'None'}`);

    const testMethods = result.allied_standards?.test_methods?.map(s => s.is_number) || [];
    console.log(`  Allied Test Methods: ${testMethods.join(', ') || 'None'}`);

    // Verification checks
    let testPass = true;

    // Check: IS 3495 must never appear as primary for unrelated queries
    if (item.q !== "brick" && item.q !== "IS 3495:2019") {
      if (primaryList.some(num => num.includes("3495"))) {
        console.error(`  [FAIL]: Unrelated IS 3495 appeared as primary recommendation!`);
        testPass = false;
      }
    }

    if (item.expectedLiveMatch) {
      if (result.primary_standards.length > 0 && duration < 15000) {
        const top = result.primary_standards[0];
        console.log(`  [PASS]: Discovered ${result.primary_standards.length} verified standards from live BIS portal in ${duration.toFixed(0)}ms (Top: ${top.is_number} - ${top.title})`);
      } else {
        console.error(`  [FAIL]: Expected live BIS standards for '${item.q}', got ${result.primary_standards.length}`);
        testPass = false;
      }
    } else if (item.expectNoMatch) {
      if (result.primary_standards.length === 0) {
        console.log(`  [PASS]: Correctly returned no false primary recommendation for unsupported query.`);
      } else {
        console.error(`  [FAIL]: Expected no match, but got primary: ${primaryList}`);
        testPass = false;
      }
    } else if (item.expectedProduct) {
      if (result.requirement.product === item.expectedProduct &&
          item.expectBisQueries.every(bq => (result.bisQueries || []).includes(bq))) {
        console.log(`  [PASS]: Cleanly parsed product as '${result.requirement.product}' and generated BIS queries: ${JSON.stringify(result.bisQueries)}`);
      } else {
        console.error(`  [FAIL]: Product '${result.requirement.product}' != '${item.expectedProduct}' or BIS queries mismatch`);
        testPass = false;
      }
    } else if (item.expectedPrimary) {
      if (primaryList.includes(item.expectedPrimary) && testMethods.includes(item.expectedAllied)) {
        console.log(`  [PASS]: Correctly designated ${item.expectedPrimary} as Primary and ${item.expectedAllied} as Allied Test Method.`);
      } else {
        console.error(`  [FAIL]: Expected Primary ${item.expectedPrimary} and Allied ${item.expectedAllied}`);
        testPass = false;
      }
    } else if (item.expectedIs) {
      if (primaryList.includes(item.expectedIs)) {
        const top = result.primary_standards.find(s => s.is_number === item.expectedIs);
        console.log(`  [PASS]: Matched ${item.expectedIs} with score ${(top.score * 100).toFixed(0)}%`);
        console.log(`  Source Badge       : ${top.verification.ui_badge}`);
        console.log(`  Why Recommended    : ${top.explanation}`);
      } else {
        console.error(`  [FAIL]: Expected ${item.expectedIs} in primary standards.`);
        testPass = false;
      }
    }

    if (testPass) passed++;
    else failed++;
  }

  console.log(`\n================================================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${canonicalQueries.length})`);
  console.log(`================================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
