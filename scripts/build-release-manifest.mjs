import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packageMetadata = JSON.parse(await readFile(
  path.join(root, "package.json"),
  "utf8"
));
const releaseId = `leap2026-pressroom-${packageMetadata.version}`;
const ignoredDirectories = new Set([".git", ".wrangler", "node_modules", "dist"]);
const ignoredFiles = new Set([
  "evidence/release-manifest.json",
  "docs/release.json"
]);
const binaryExtensions = new Set([".png", ".wasm", ".webm"]);

async function collect(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collect(absolute, relative));
    } else if (entry.isFile() && !ignoredFiles.has(relative)) {
      files.push({ absolute, relative });
    }
  }
  return files;
}

const source = JSON.parse(await readFile(
  path.join(root, "evidence", "source-snapshot.json"),
  "utf8"
));
const files = (await collect(root)).sort(
  (left, right) => left.relative.localeCompare(right.relative, "en")
);
const records = [];
for (const file of files) {
  const sourceBytes = await readFile(file.absolute);
  const bytes = binaryExtensions.has(path.extname(file.relative).toLowerCase())
    ? sourceBytes
    : Buffer.from(
        sourceBytes.toString("utf8").replace(/\r\n?/gu, "\n"),
        "utf8"
      );
  records.push({
    path: file.relative,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}
const canonical = records
  .map(record => `${record.sha256} ${record.bytes} ${record.path}\n`)
  .join("");
const releaseRoot = createHash("sha256").update(canonical).digest("hex");
const manifest = {
  schema: "sbay.leap2026.public-release.v1",
  auditId: source.auditId,
  capturedAtUtc: source.capturedAtUtc,
  releaseId,
  classification: "public-non-enabling-press-material",
  fileCount: records.length,
  releaseRoot,
  files: records
};
const json = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(
  path.join(root, "evidence", "release-manifest.json"),
  json,
  "utf8"
);
await writeFile(
  path.join(root, "docs", "release.json"),
  `${JSON.stringify({
    schema: manifest.schema,
    auditId: manifest.auditId,
    releaseId: manifest.releaseId,
    classification: manifest.classification,
    fileCount: manifest.fileCount,
    releaseRoot: manifest.releaseRoot
  }, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify({
  releaseId: manifest.releaseId,
  fileCount: manifest.fileCount,
  releaseRoot
}));
