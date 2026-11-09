# Training PDF Stamper

Training PDF Stamper creates personalized copies of a PDF for each buyer. It can add a visible diagonal `CONFIDENTIAL` watermark to every page and stores the buyer's name in the PDF `Subject` metadata as `Licensed to <buyer name>`. Generated files are saved under `stamped/`.

> Important: the visible watermark is only a visual marker. The buyer name is stored in document metadata, and that metadata can be viewed, edited, or removed by other PDF tools. This tool is not a DRM or copy-protection system.

## Features

- Creates one PDF per buyer from a configured template
- Adds a light, semi-transparent diagonal `CONFIDENTIAL` watermark when requested
- Writes the buyer identity into PDF metadata for verification
- Supports verifying a single PDF, a folder, or the generated `stamped/` output
- Sanitizes buyer names into safe folder names for output files
- Saves a JSON manifest for each run containing the run ID, timestamp, template name, and buyers

## Requirements

- Node.js 18 or later
- npm
- A PDF template in the project folder

## Quick start

From the repository root, install dependencies:

```bash
npm install
```

Run the interactive tool:

```bash
npx tsx stamp.tsx
```

On Windows, you can also run:

```bat
stamp.bat
```

The script uses `tsx` via `npx`, so it may download `tsx` automatically if it is not already installed.

## Main menu

The menu offers:

1. Stamp PDFs for buyers
2. Verify stamps
3. Quit

## Stamping PDFs

Choose `1` to stamp PDFs for buyers. Enter buyer names separated by commas, semicolons, or new lines. Duplicate names are removed case-insensitively, and spaces inside names are preserved.

Example input:

```text
Alice Smith, Bob Jones
```

The tool then:

- loads the configured template file
- writes a copy to `stamped/<buyer name>/`
- optionally adds a diagonal visible `CONFIDENTIAL` watermark
- sets the PDF `Subject` metadata to `Licensed to <buyer name>`
- saves a manifest in `stamped/manifests/`

The template is configured in `stamp.tsx`:

```ts
const templateFiles = [
  "BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf",
];
```

The script resolves that template path relative to itself, so it works from any working directory.

## Output structure

Example output:

```text
stamped/
├── Alice Smith/
│   └── BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf
├── Bob Jones/
│   └── BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf
├── manifests/
│   └── 20261109-184015.json
└── ...
```

https://github.com/user-attachments/assets/090bd9c3-7a4b-49b2-adce-ea1132472b47


## Verification

Choose `2` to verify stamps. You can:

- check a single PDF file
- check a folder recursively
- leave the path blank to scan the full `stamped/` directory
- optionally require a buyer name to match exactly (case-insensitive)

Verification reads the PDF metadata and looks for a `Subject` starting with `Licensed to `. It does not validate whether the visible watermark is present.

## Project files

- `stamp.tsx` — main stamping and verification logic
- `stamp.bat` — Windows launcher
- `package.json` — project dependencies
- `BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf` — default PDF template
- `stamped/` — generated stamped PDFs and manifests

## Notes

- File names are sanitized for invalid filesystem characters when creating buyer folders.
- If a PDF already exists for a buyer, it is overwritten during stamping.
- This project is intended for controlled internal distribution and simple traceability, not for strong document protection.
