# Training PDF Stamper

This project creates a personalised copy of each configured PDF template for every buyer. It stamps each buyer's name diagonally across every page, writes one output folder per buyer, and verifies that the expected text was actually embedded in each generated PDF.

It is intended for small batch mailouts where the same PDF template needs to be customized for many recipients.

## Features

- Reads PDF templates from the same directory as `stamp.tsx`
- Accepts buyer names for stamping (no email addresses are required)
- Creates one folder per buyer under `stamped/`
- Saves each personalized PDF next to the template output for that user
- Writes a JSON manifest to `stamped/manifests/`
- Verifies generated PDFs by reading extracted text and checking for the expected sender/recipient stamp
- Includes a simple interactive menu for stamping and verification

## Requirements

- Node.js 18+
- A PDF file saved alongside `stamp.tsx`

## Install

From the project root:

```bash
npm install
```

This project depends on:

- `pdf-lib` for editing PDF files
- `pdf-parse` for verifying the embedded text
- `tsx` for running the TypeScript script directly

## Run it

### Option 1: from the terminal

```bash
npx tsx stamp.tsx
```

### Option 2: on Windows using the helper batch file

```bat
stamp.bat
```

When the app starts, it shows:

- `1) Stamp PDFs for recipients`
- `2) Verify stamps`
- `3) Quit`

Choose the option you want.

## How stamping works

In the stamping flow, the script asks for buyer names. You can enter several names separated by commas, semicolons, or new lines. Keep spaces within each name.

Example:

```text
Buyer names (separate with commas or new lines): Alice Smith, Bob Jones
```

Each name is stamped on its own PDF. The name is not converted into an email link.

## Template configuration

The current project uses the PDF file already included in the repo:

```ts
const templateFiles = [
  "BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf",
];
```

The script resolves the template relative to the script folder, so the PDF can be kept beside `stamp.tsx` without needing a complicated path setup.

## Output structure

Example output layout:

```text
stamped/
├── Alice Smith/
│   └── BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf
├── Bob Jones/
│   └── BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf
└── manifests/
    └── 20261107-220442.json
```

The manifest contains a run ID, timestamp, template name, and the list of successful recipients for that run.

## Verification

After a PDF is created, the script extracts text from it and checks whether the expected string is present.

- `FOUND` means the buyer-name stamp was detected
- `MISSING` means the stamp was not found and the file should be checked manually

The verify flow can also scan all PDFs under `stamped/` and report pass/fail for each file. 
When verifying, enter a PDF file path to check a leaked file directly, or enter a folder path to scan PDFs in that folder and its subfolders. Press Enter at the path prompt to keep scanning `stamped/`.

## Project files

- `stamp.tsx` — main app logic
- `stamp.bat` — Windows wrapper for running the script
- `package.json` — project dependencies
- `README.md` — project documentation
- `BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf` — sample PDF template

## Notes

- `pdf-parse` is pinned to `1.1.1` because newer versions can break the import pattern used by this script.
- Folder names are sanitized to avoid invalid filesystem characters while keeping the buyer name readable.
- This project is designed for local batch stamping, not for a full production document-generation system.

## Example result

<img width="944" height="503" alt="image" src="https://github.com/user-attachments/assets/2a50710b-98f8-4542-b57e-621e99926abb" />

Video demo:

https://github.com/user-attachments/assets/3a2df96c-630c-4cbb-acbd-cc730774dab2

