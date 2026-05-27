import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const guardedRoutes: Array<[string, string]> = [
  ["src/app/api/ai/review/route.ts", "requireProjectAccess("],
  ["src/app/api/mastra/review/route.ts", "requireProjectAccess("],
  ["src/app/api/mastra/stream/route.ts", "requireProjectAccess("],
  ["src/app/api/documents/[documentId]/parse/route.ts", "requireDocumentAccess("],
  ["src/app/api/documents/[documentId]/extract/route.ts", "requireDocumentAccess("],
  ["src/app/api/documents/[documentId]/blocks/route.ts", "requireDocumentAccess("],
  ["src/app/api/documents/[documentId]/images/route.ts", "requireDocumentAccess("],
  ["src/app/api/images/[documentId]/[filename]/route.ts", "requireDocumentAccess("],
  ["src/app/api/documents/[documentId]/extraction-items/route.ts", "requireDocumentAccess("],
  ["src/app/api/documents/[documentId]/extraction-items/[itemId]/route.ts", "requireDocumentAccess("],
  ["src/app/api/extraction-items/route.ts", "requireProjectAccess("],
  ["src/app/api/extraction-items/[itemId]/route.ts", "requireExtractionItemAccess("],
  ["src/app/api/extraction-items/batch-delete/route.ts", "requireExtractionItemsAccess("],
  ["src/app/api/reports/[reportId]/issues/route.ts", "requireReportAccess("],
];

for (const [file, marker] of guardedRoutes) {
  const source = readFileSync(join(root, file), "utf8");
  assert.ok(
    source.includes(marker),
    `${file} must call ${marker} before accessing tenant-scoped data`,
  );
}

console.log(`Checked ${guardedRoutes.length} tenant-scoped route guards.`);
