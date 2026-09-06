import { runFastAnalysis } from './server/services/recommendation/recommendationEngine.js';

const testQueries = [
  "ball point pen for office use",
  "LED lamp",
  "90W LED street lights for outdoor road lighting with IP66 protection",
  "HDPE plastic water storage tanks for drinking water",
  "Ordinary Portland Cement 43 Grade for school building construction"
];

async function run() {
  console.log("====================================================");
  console.log("RUNNING TEST SUITE: 5 CANONICAL PROCUREMENT QUERIES");
  console.log("====================================================");

  for (const q of testQueries) {
    const start = performance.now();
    const result = await runFastAnalysis(q, "product_description", false);
    const duration = performance.now() - start;

    console.log(`\n[QUERY]: "${q}"`);
    console.log(`  Total Latency: ${duration.toFixed(2)} ms`);
    console.log(`  Identified Product: ${result.requirement.product || 'N/A'}`);
    console.log(`  Primary Standards: ${result.primary_standards.map(s => s.is_number).join(', ') || 'None'}`);
    const alliedCount = Object.values(result.allied_standards).reduce((acc, arr) => acc + arr.length, 0);
    console.log(`  Allied Standards Count: ${alliedCount}`);
    console.log(`  Stage Timings (ms):`, result.timings);

    if (result.primary_standards.length > 0) {
      const top = result.primary_standards[0];
      console.log(`  Top Recommendation: ${top.is_number} - ${top.title} (Score: ${(top.score * 100).toFixed(1)}%)`);
      console.log(`  Trust Badge: ${top.verification.ui_badge} (${top.verification.status})`);
      console.log(`  Reason: ${top.explanation}`);
    }
  }
}

run().catch(console.error);
