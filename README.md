# Training PDF Stamper

Training PDF Stamper creates a separate copy of the configured PDF for each buyer. It adds a diagonal **CONFIDENTIAL** watermark to every page and records the buyer's name in the PDF's **Subject metadata**. The personalized copy is written under `stamped/`.

> **Important:** The visible watermark says only “CONFIDENTIAL”; the buyer's name is stored separately in document metadata. Metadata can be viewed, edited, or removed by other PDF tools, and the watermark is not a copy-protection mechanism.

## Requirements

- Node.js 18 or later
- npm
- The configured PDF template in the project folder

## Setup and run

Install the project dependencies from the repository root:

```bash
npm install
```

Run the interactive tool:

```bash
npx tsx stamp.tsx
```

On Windows, you can instead run:

```bat
stamp.bat
```

The script uses `tsx` through `npx`; `tsx` is not listed as a project dependency, so `npx` may download it if it is not already available.

The menu offers:

1. Stamp PDFs for buyers
2. Verify stamps
3. Quit

## Stamping PDFs

Choose **Stamp PDFs for buyers**, then enter buyer names separated by commas, semicolons, or new lines. Spaces within names are preserved. Duplicate names are removed case-insensitively.

For example:

```text
Alice Smith, Bob Jones
```

For each buyer, the script writes a light-gray, semi-transparent “CONFIDENTIAL” watermark diagonally across every page. It also sets the PDF Subject to `Licensed to <buyer name>`. The script creates a buyer folder under `stamped/` and saves a copy of the configured template there. If a buyer's output file already exists, it is overwritten.

The template is currently configured in `stamp.tsx`:

```ts
const templateFiles = [
  "BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf",
];
```

The template path is resolved relative to the script, so run the tool from any working directory.

## Output

The output structure is similar to:

```text
stamped/
├── Alice Smith/
│   └── BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf
├── Bob Jones/
│   └── BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf
└── manifests/
    └── 20261109-184015.json
```

Each run writes a JSON manifest with the run ID, timestamp, template filename, and buyer names. Folder names are sanitized for invalid filesystem characters.

## Verify stamps

Choose **Verify stamps** to check a PDF file or recursively scan a folder. Press Enter at the path prompt to scan `stamped/`. You can optionally provide a buyer name to require that exact name; name comparisons are case-insensitive. Verification reads the PDF Subject metadata and reports whether a `Licensed to ` stamp was found.

The stamping flow also verifies each newly written file against its buyer name. Verification checks the buyer-identifying Subject metadata only; it does not check whether the visible page watermark is present.

## Project files

- `stamp.tsx` — stamping, verification, and interactive menu
- `stamp.bat` — Windows launcher
- `package.json` — project dependencies
- `BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf` — configured PDF template
- `stamped/` — generated PDFs and run manifests
