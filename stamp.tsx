import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pdfParse from "pdf-parse";

// Folder this script lives in, so paths work wherever you run it from
const here = dirname(fileURLToPath(import.meta.url));
const templateBase = "BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author";
const templatePath = join(here, `${templateBase}.pdf`);
const outDir = join(here, "stamped");

// Basic format check. Good enough to catch typos, but can't confirm the mailbox exists
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

// Each recipient gets their own folder, e.g. stamped/alice@example.com/
// The PDF inside keeps the template filename, so the email isn't in the name
function outputFile(outDir: string, email: string) {
  // Strip characters that aren't safe in folder names, such as slashes
  const safeFolder = email.replace(/[^a-z0-9@.-]/gi, "_");
  return join(outDir, safeFolder, `${templateBase}.pdf`);
}

// Stamps one copy of the template PDF with a recipient's email
async function stampCopy(templatePath: string, email: string, outDir: string) {
  // Reload the template for every recipient so stamps never pile up on each other
  const pdf = await PDFDocument.load(await readFile(templatePath));
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    page.drawText(`Licensed to ${email}`, {
      x: width * 0.15, // Start partway across so the stamp runs diagonally through the page
      y: height * 0.5,
      size: 24,
      font,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.35, // Faint enough to read the content, visible enough to deter
      rotate: degrees(35),
    });
  }

  const file = outputFile(outDir, email);
  await mkdir(dirname(file), { recursive: true }); // Create this recipient's folder
  await writeFile(file, await pdf.save());
}

// Checks each stamped PDF actually contains its recipient's stamp text
async function verifyStamps(outDir: string, emails: string[]) {
  for (const email of emails) {
    const file = outputFile(outDir, email);
    const { text } = await pdfParse(await readFile(file));
    const stamp = `Licensed to ${email}`;
    const ok = text.includes(stamp);
    console.log(ok ? `FOUND: ${email}` : `MISSING: ${email}`);
  }
}

async function main() {
  const recipients = ["alice@example.com", "bob@example.com"]; // Replace with your buyer list

  // Trim, lowercase and dedupe so the same buyer isn't stamped twice
  const cleaned = [...new Set(recipients.map((e) => e.trim().toLowerCase()))];

  const invalid = cleaned.filter((e) => !isValidEmail(e));
  if (invalid.length > 0) {
    console.error("Skipping invalid addresses:", invalid);
  }
  const valid = cleaned.filter(isValidEmail);

  await mkdir(outDir, { recursive: true });

  // Run one at a time so a failure is easy to spot and retry
  for (const email of valid) {
    await stampCopy(templatePath, email, outDir);
    console.log(`Stamped copy for ${email}`);
  }

  // Only check files after every stamp is written
  await verifyStamps(outDir, valid);
}

main().catch(console.error);