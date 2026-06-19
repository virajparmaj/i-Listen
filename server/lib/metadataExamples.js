import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { listMetadataExamples } from "./db.js";

export function metadataExampleToJsonlRow(example = {}) {
  return {
    input: example.input || {},
    output: example.output || {},
    source: example.source || "",
    jobId: example.jobId || "",
    createdAt: example.createdAt || "",
  };
}

export function metadataExamplesToJsonl(examples = []) {
  const rows = (Array.isArray(examples) ? examples : []).map((example) => JSON.stringify(metadataExampleToJsonlRow(example)));
  return rows.length ? `${rows.join("\n")}\n` : "";
}

export async function writeMetadataExamplesJsonl(db, outputPath, { list = listMetadataExamples } = {}) {
  const examples = list(db, null);
  const content = metadataExamplesToJsonl(examples);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, "utf8");
  return { outputPath, count: examples.length };
}
