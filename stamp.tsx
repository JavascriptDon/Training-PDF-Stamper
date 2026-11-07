import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pdfParse from "pdf-parse";

// Resolve paths relative to this script so the tool works from any working directory.
const here = dirname(fileURLToPath(import.meta.url));
const templateFiles = [
  "BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf",
];
const outDir = join(here, "stamped");

// Basic email validation: catches obvious address mistakes without guaranteeing the mailbox exists.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Manifest = {
  runId: string;
  createdAt: string;
  templates: string[];
  recipients: string[];
};

// Keep the email validation logic in one place so the same rule is reused everywhere.
function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

// Build a timestamp-based run ID that is sortable and readable in folder names.
function createRunId(): string {
  const now = new Date();

  return (
    `${now.getFullYear()}` +
    `${String(now.getMonth() + 1).padStart(2, "0")}` +
    `${String(now.getDate()).padStart(2, "0")}` +
    "-" +
    `${String(now.getHours()).padStart(2, "0")}` +
    `${String(now.getMinutes()).padStart(2, "0")}` +
    `${String(now.getSeconds()).padStart(2, "0")}`
  );
}

// Store each recipient in its own folder, e.g. stamped/alice@example.com/.
// The PDF keeps the original template filename, so the email is only used for the folder name.
function outputFile(outDir: string, email: string, templateFile: string) {
  // Replace unsafe characters so the recipient folder remains valid on disk.
  const safeFolder = email.replace(/[^a-z0-9@.-]/gi, "_");
  return join(outDir, safeFolder, basename(templateFile));
}

// Stamp a single document with the recipient's email and write it to the output folder.
async function stampCopy(
  templatePath: string,
  templateFile: string,
  email: string,
) {
  const pdf = await PDFDocument.load(
    await readFile(templatePath),
  );

  const font = await pdf.embedFont(
    StandardFonts.Helvetica,
  );

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

  const file = outputFile(
    outDir,
    email,
    templateFile,
  );

  await mkdir(dirname(file), {
    recursive: true,
  });

  await writeFile(
    file,
    await pdf.save(),
  );
}

// Persist a run manifest so each batch has a record of the template and recipient list used.
async function saveManifest(
  manifest: Manifest,
) {
  const manifestDir = join(
    outDir,
    "manifests",
  );

  await mkdir(manifestDir, {
    recursive: true,
  });

  const manifestPath = join(
    manifestDir,
    `${manifest.runId}.json`,
  );

  await writeFile(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  console.log(
    `Manifest saved: ${manifestPath}`,
  );

  return manifestPath;
}

// Check that each stamped PDF actually contains the expected email text.
async function verifyManifest(
  manifest: Manifest,
) {
  console.log("\nVerifying output...\n");

  for (const email of manifest.recipients) {
    for (const templateFile of manifest.templates) {
      const file = outputFile(
        outDir,
        email,
        templateFile,
      );

      const { text } = await pdfParse(
        await readFile(file),
      );

      const expected =
        `Licensed to ${email}`;

      const ok =
        text.includes(expected);

      console.log(
        ok
          ? `FOUND: ${email} in ${templateFile}`
          : `MISSING: ${email} in ${templateFile}`,
      );
    }
  }
}

// Main orchestration: normalize recipients, generate output, save metadata, and verify the results.
async function main() {
  const recipients = [
    "alice@example.com",
    "bob@example.com",
  ];

  const cleaned = [
    ...new Set(
      recipients.map((e) =>
        e.trim().toLowerCase(),
      ),
    ),
  ];

  const invalid = cleaned.filter(
    (e) => !isValidEmail(e),
  );

  if (invalid.length > 0) {
    console.error(
      "Invalid email addresses:",
      invalid,
    );
  }

  const valid =
    cleaned.filter(isValidEmail);

  await mkdir(outDir, {
    recursive: true,
  });

  const runId = createRunId();

  const manifest: Manifest = {
    runId,
    createdAt:
      new Date().toISOString(),
    templates: templateFiles,
    recipients: valid,
  };

  for (const email of valid) {
    for (const templateFile of templateFiles) {
      await stampCopy(
        join(here, templateFile),
        templateFile,
        email,
      );

      console.log(
        `Stamped ${templateFile} for ${email}`,
      );
    }
  }

  await saveManifest(manifest);

  await verifyManifest(manifest);
}

main().catch(console.error);