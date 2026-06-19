import { join, resolve } from "node:path";
import { openDatabase } from "../lib/db.js";
import { writeMetadataExamplesJsonl } from "../lib/metadataExamples.js";
import { DEFAULT_PROJECT_PATH, ensureProject } from "../lib/paths.js";

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  return process.argv[index + 1] || "";
}

const projectPath = resolve(argValue("--project") || process.env.ILISTEN_PROJECT || DEFAULT_PROJECT_PATH);
const project = ensureProject(projectPath);
const outputPath = resolve(argValue("--output") || join(project.root, "metadata-examples.jsonl"));
const db = openDatabase(project.dbPath);

try {
  const result = await writeMetadataExamplesJsonl(db, outputPath);
  console.log(`Wrote ${result.count} metadata examples to ${result.outputPath}`);
} finally {
  db.close();
}
