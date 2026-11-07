import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pdfParse from "pdf-parse";

// Resolve paths relative to this script so the tool works from any working directory.
const here = dirname(fileURLToPath(import.meta.url));
const templateFiles = [
  "BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf",
];
const templatePath = join(here, templateFiles[0]);
const outDir = join(here, "stamped");

// Basic email check: catches obvious typos without confirming the mailbox exists.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Manifest = {
  runId: string;
  createdAt: string;
  template: string;
  recipients: string[];
};

type Result = {
  file: string;
  ok: boolean;
  message: string;
};

/* ---------- helpers ---------- */

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

// Split pasted input on commas, spaces or new lines, then clean up and sort into valid and invalid.
function parseEmails(input: string): { valid: string[]; invalid: string[] } {
  const cleaned = [
    ...new Set(
      input
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  return {
    valid: cleaned.filter(isValidEmail),
    invalid: cleaned.filter((e) => !isValidEmail(e)),
  };
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

// One folder per recipient, e.g. stamped/alice@example.com/. The PDF keeps the template's filename.
function outputPath(email: string): string {
  // Swap out characters that aren't safe in folder names.
  const safeFolder = email.replace(/[^a-z0-9@.-]/gi, "_");
  return join(outDir, safeFolder, basename(templateFiles[0]));
}

// Remove all whitespace before comparing. Rotated text often comes out of pdf-parse with gaps in odd places.
function squash(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

// Find every "Licensed to <email>" in the squashed text. Used to report which stamps are present.
function emailsInStamps(squashedText: string): string[] {
  const pattern = /licensedto([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/g;
  return [...new Set([...squashedText.matchAll(pattern)].map((m) => m[1]))];
}

// Collect PDFs from a file or folder. Folders are searched recursively, so recipient subfolders are included.
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

// Load the template once, then stamp a fresh copy for each recipient.
async function stampOne(templateBytes: Uint8Array, email: string): Promise<void> {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    page.drawText(`Licensed to ${email}`, {
      x: width * 0.15,
      y: height * 0.5,
      size: 24,
      font,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.35,
      rotate: degrees(35),
    });
  }

  const file = outputPath(email);
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

// Check one PDF. With an email, look for that exact stamp. Without one, report whichever stamps are there.
async function checkPdf(file: string, wantedEmail?: string): Promise<Result> {
  let text: string;
  try {
    ({ text } = await pdfParse(await readFile(file)));
  } catch {
    return { file, ok: false, message: "Could not read this PDF" };
  }

  const squashed = squash(text);

  if (wantedEmail) {
    const wanted = wantedEmail.toLowerCase();
    if (squashed.includes(`licensedto${wanted}`)) {
      return { file, ok: true, message: `Stamp for ${wanted} found` };
    }
    const others = emailsInStamps(squashed);
    const hint = others.length ? ` (found stamp for: ${others.join(", ")})` : "";
    return { file, ok: false, message: `No stamp for ${wanted}${hint}` };
  }

  const emails = emailsInStamps(squashed);
  if (emails.length === 0) {
    return { file, ok: false, message: "No stamp found" };
  }
  return { file, ok: true, message: `Stamped for ${emails.join(", ")}` };
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
    "Recipient emails (separate with commas or spaces): ",
  );
  const { valid, invalid } = parseEmails(input);

  if (invalid.length > 0) {
    console.log(`Skipping invalid addresses: ${invalid.join(", ")}`);
  }
  if (valid.length === 0) {
    console.log("No valid emails entered. Nothing to do.\n");
    return;
  }

  await mkdir(outDir, { recursive: true });
  const templateBytes = await readFile(templatePath);

  for (const email of valid) {
    await stampOne(templateBytes, email);
    console.log(`Stamped for ${email}`);
  }

  const manifestPath = await saveManifest({
    runId: createRunId(),
    createdAt: new Date().toISOString(),
    template: templateFiles[0],
    recipients: valid,
  });
  console.log(`\nManifest saved: ${manifestPath}`);

  // Check each new file for its own recipient's stamp straight after writing it.
  console.log("\nVerifying new files...\n");
  for (const email of valid) {
    printResult(await checkPdf(outputPath(email), email), outDir);
  }
  console.log();
}

async function verifyFlow(rl: Interface) {
  // Always check the stamped folder. Recipient subfolders are included by findPdfs.
  const target = outDir;

  const emailInput = (
    await rl.question("Check for one email only? (Enter to check any): ")
  )
    .trim()
    .toLowerCase();

  let files: string[];
  try {
    files = await findPdfs(target);
  } catch {
    console.log(`Can't find anything at: ${target}\n`);
    return;
  }
  if (files.length === 0) {
    console.log("No PDFs found there.\n");
    return;
  }

  console.log(`\nChecking ${files.length} PDF(s)...\n`);
  let failed = 0;
  for (const file of files) {
    const result = await checkPdf(file, emailInput || undefined);
    if (!result.ok) failed++;
    printResult(result, target);
  }
  console.log(`\n${files.length - failed} passed, ${failed} failed.\n`);
}

/* ---------- main menu ---------- */

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log("Stamp tool\n");

  try {
    while (true) {
      console.log("1) Stamp PDFs for recipients");
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