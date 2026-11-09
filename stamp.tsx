import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

// Resolve paths relative to this script so the tool works from any working directory.
const here = dirname(fileURLToPath(import.meta.url));
const templateFiles = [
  "BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf",
];
const templatePath = join(here, templateFiles[0]);
const outDir = join(here, "stamped");

// The stamp lives in the Subject field, so every buyer's copy carries the same prefix.
const STAMP_PREFIX = "Licensed to ";

type Manifest = {
  runId: string;
  createdAt: string;
  template: string;
  recipients: string[];
  watermark: boolean;
};

type Result = {
  file: string;
  ok: boolean;
  message: string;
};

/* ---------- helpers ---------- */

// Split pasted names on commas, semicolons or new lines, preserving spaces within each name.
function parseBuyerNames(input: string): string[] {
  const names = input
    .split(/[,;\r\n]+/)
    .map((name) => name.trim())
    .filter(Boolean);
  return [
    ...new Map(
      names.map((name) => [name.toLowerCase(), name] as const),
    ).values(),
  ];
}

// Timestamp-based run ID, e.g. 20261107-224700. Sorts well and is easy to read.
function createRunId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

// One folder per buyer. The PDF keeps the template's filename.
function outputPath(buyerName: string): string {
  const safeFolder = buyerName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/[. ]+$/g, "");
  return join(outDir, safeFolder, basename(templateFiles[0]));
}

// Collect PDFs from a file or folder. Folders are searched recursively, so buyer subfolders are included.
async function findPdfs(target: string): Promise<string[]> {
  const info = await stat(target);
  if (info.isFile()) return [target];

  const found: string[] = [];
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const path = join(target, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findPdfs(path)));
    } else if (extname(entry.name).toLowerCase() === ".pdf") {
      found.push(path);
    }
  }
  return found;
}

/* ---------- stamping ---------- */

// Load the template once, then write a fresh copy. The watermark is optional; the Subject field is always set.
async function stampOne(
  templateBytes: Uint8Array,
  buyerName: string,
  withWatermark: boolean,
): Promise<void> {
  const pdf = await PDFDocument.load(templateBytes);

  // Optional visible watermark on every page. Kept light so the content stays readable.
  if (withWatermark) {
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      page.drawText("CONFIDENTIAL", {
        x: width * 0.2,
        y: height * 0.45,
        size: 58,
        font,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.25,
        rotate: degrees(35),
      });
    }
  }

  // Hidden metadata that identifies the buyer. Always set, watermark or not.
  pdf.setSubject(`${STAMP_PREFIX}${buyerName}`);

  const file = outputPath(buyerName);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, await pdf.save());
}

async function saveManifest(manifest: Manifest): Promise<string> {
  const dir = join(outDir, "manifests");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${manifest.runId}.json`);
  await writeFile(path, JSON.stringify(manifest, null, 2), "utf8");
  return path;
}

/* ---------- verifying ---------- */

// Check one PDF. With a name, look for that exact stamp.
async function checkPdf(file: string, wantedName?: string): Promise<Result> {
  let subject: string | undefined;
  try {
    // updateMetadata: false stops pdf-lib from touching the file's dates or producer on read.
    const pdf = await PDFDocument.load(await readFile(file), {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    subject = pdf.getSubject();
  } catch {
    return { file, ok: false, message: "Could not read this PDF" };
  }

  const stamp = subject?.startsWith(STAMP_PREFIX)
    ? subject.slice(STAMP_PREFIX.length).trim()
    : undefined;

  if (wantedName) {
    // Compare case-insensitively so "jane smith" matches "Jane Smith".
    if (stamp?.toLowerCase() === wantedName.trim().toLowerCase()) {
      return { file, ok: true, message: `Stamp for ${wantedName} found` };
    }
    return { file, ok: false, message: `No stamp for ${wantedName}` };
  }

  if (!stamp) {
    return { file, ok: false, message: "No stamp found" };
  }
  return { file, ok: true, message: `Stamp found: ${stamp}` };
}

function printResult(result: Result, base?: string) {
  // Show paths relative to the folder being checked so the output is easier to scan.
  const label =
    base && result.file.startsWith(base)
      ? result.file.slice(base.length + 1)
      : result.file;
  console.log(`${result.ok ? "✔" : "✘"} ${label}`);
  console.log(`    ${result.message}`);
}

/* ---------- menu actions ---------- */

async function stampFlow(rl: Interface) {
  const input = await rl.question(
    "Buyer names (separate with commas or new lines): ",
  );
  const buyerNames = parseBuyerNames(input);
  if (buyerNames.length === 0) {
    console.log("No buyer names entered. Nothing to do.\n");
    return;
  }

  // Ask once for the whole run. Anything other than y/yes means metadata only.
  const watermarkAnswer = (
    await rl.question("Add visible CONFIDENTIAL watermark too? (y/N): ")
  )
    .trim()
    .toLowerCase();
  const withWatermark = watermarkAnswer === "y" || watermarkAnswer === "yes";

  await mkdir(outDir, { recursive: true });
  const templateBytes = await readFile(templatePath);

  for (const buyerName of buyerNames) {
    await stampOne(templateBytes, buyerName, withWatermark);
    console.log(
      `Stamped for ${buyerName}${withWatermark ? " (watermarked)" : ""}`,
    );
  }

  const manifestPath = await saveManifest({
    runId: createRunId(),
    createdAt: new Date().toISOString(),
    template: templateFiles[0],
    recipients: buyerNames,
    watermark: withWatermark,
  });
  console.log(`\nManifest saved: ${manifestPath}`);

  // Check each new file for its own buyer's stamp straight after writing it.
  console.log("\nVerifying new files...\n");
  for (const buyerName of buyerNames) {
    printResult(await checkPdf(outputPath(buyerName), buyerName), outDir);
  }
  console.log();
}

async function verifyFlow(rl: Interface) {
  const targetInput = (
    await rl.question("PDF file or folder to check (Enter to scan stamped): ")
  ).trim();
  const target = targetInput || outDir;

  const nameInput = (
    await rl.question("Check for one buyer name only? (Enter to check any): ")
  ).trim();

  let files: string[];
  try {
    files = await findPdfs(target);
  } catch {
    console.log(`Can't find anything at: ${target}\n`);
    return;
  }
  if (files.length === 0) {
    console.log(`No PDFs found at: ${target}\n`);
    return;
  }

  console.log(`\nChecking ${files.length} PDF(s)...\n`);
  let failed = 0;
  for (const file of files) {
    const result = await checkPdf(file, nameInput || undefined);
    if (!result.ok) failed++;
    printResult(result, file === target ? undefined : target);
  }
  console.log(`\n${files.length - failed} passed, ${failed} failed.\n`);
}

/* ---------- main menu ---------- */

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log("Stamp tool\n");

  try {
    while (true) {
      console.log("1) Stamp PDFs for buyers");
      console.log("2) Verify stamps");
      console.log("3) Quit");

      const choice = (await rl.question("\nChoose 1, 2 or 3: ")).trim();
      console.log();

      if (choice === "1") {
        await stampFlow(rl);
      } else if (choice === "2") {
        await verifyFlow(rl);
      } else if (choice === "3") {
        break;
      } else {
        console.log("Please enter 1, 2 or 3.\n");
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("Something went wrong:", err);
  process.exitCode = 1;
});