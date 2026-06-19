import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addMetadataExample, openDatabase } from "./db.js";
import { metadataExamplesToJsonl, writeMetadataExamplesJsonl } from "./metadataExamples.js";

let tempDir = null;

function tempDb() {
  tempDir = mkdtempSync(join(tmpdir(), "ilisten-examples-"));
  return openDatabase(join(tempDir, "ilisten.sqlite"));
}

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("metadata examples JSONL export", () => {
  it("formats correction examples for later fine-tuning or evaluation", () => {
    const jsonl = metadataExamplesToJsonl([{
      jobId: "job-1",
      source: "manual_edit",
      input: { before: { title: "Messy" } },
      output: { title: "Clean", artist: "Artist" },
      createdAt: "2026-06-18T12:00:00.000Z",
    }]);

    const row = JSON.parse(jsonl.trim());
    expect(row).toEqual({
      input: { before: { title: "Messy" } },
      output: { title: "Clean", artist: "Artist" },
      source: "manual_edit",
      jobId: "job-1",
      createdAt: "2026-06-18T12:00:00.000Z",
    });
  });

  it("writes all stored metadata examples to JSONL", async () => {
    const db = tempDb();
    addMetadataExample(db, {
      jobId: "job-1",
      source: "manual_edit",
      input: { before: { title: "Old" } },
      output: { title: "New" },
    });
    addMetadataExample(db, {
      jobId: "job-2",
      source: "ai_approval",
      input: { evidence: { currentMetadata: { title: "AI Old" } } },
      output: { title: "AI New" },
    });

    const outputPath = join(tempDir, "exports", "metadata-examples.jsonl");
    const result = await writeMetadataExamplesJsonl(db, outputPath);
    const lines = readFileSync(outputPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));

    expect(result).toMatchObject({ outputPath, count: 2 });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ source: "ai_approval", output: { title: "AI New" } });
    expect(lines[1]).toMatchObject({ source: "manual_edit", output: { title: "New" } });
  });
});
