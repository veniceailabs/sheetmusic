import fs from "node:fs";
import path from "node:path";

const root = "/Users/DRA/apps/Sheet Music";
const matrixPath = path.join(root, "config", "feature-matrix.json");

const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));

const allowedStatuses = new Set(matrix.statuses);
const allowedPhases = new Set(matrix.phases);
const ids = new Set();
const issues = [];

for (const feature of matrix.features) {
  if (!feature.id || ids.has(feature.id)) {
    issues.push(`Duplicate or missing feature id: ${feature.id ?? "<missing>"}`);
  }
  ids.add(feature.id);

  if (!allowedStatuses.has(feature.status)) {
    issues.push(`Invalid status for ${feature.id}: ${feature.status}`);
  }

  if (!allowedPhases.has(feature.phase)) {
    issues.push(`Invalid phase for ${feature.id}: ${feature.phase}`);
  }

  if (!feature.implementationTarget || feature.implementationTarget.trim().length < 15) {
    issues.push(`Implementation target too weak for ${feature.id}`);
  }

  if (!Array.isArray(feature.acceptanceCriteria) || feature.acceptanceCriteria.length === 0) {
    issues.push(`Missing acceptance criteria for ${feature.id}`);
  }

  for (const criterion of feature.acceptanceCriteria ?? []) {
    if (typeof criterion !== "string" || criterion.trim().length < 10) {
      issues.push(`Weak acceptance criterion for ${feature.id}`);
    }
  }
}

const phaseCounts = matrix.features.reduce((acc, feature) => {
  acc[feature.phase] = (acc[feature.phase] ?? 0) + 1;
  return acc;
}, {});

if (issues.length > 0) {
  console.error("Specification validation failed.");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Specification validation passed.");
console.log(`Validated ${matrix.features.length} features.`);
console.log("Features by phase:");
for (const phase of matrix.phases) {
  console.log(`- ${phase}: ${phaseCounts[phase] ?? 0}`);
}
