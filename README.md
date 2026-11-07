# Training PDF Stamper

This project creates a personalised copy of each configured PDF template for every recipient. It stamps each recipient's email diagonally across every page, writes one output folder per recipient, and verifies that the expected text was actually embedded in each generated PDF.

## What it does

- Reads template PDFs from the same folder as `stamp.tsx`
- Generates a stamped copy for each recipient
- Saves output under `stamped/<recipient-email>/`
- Validates email addresses before stamping
- Writes a JSON run manifest to `stamped/manifests/`
- Verifies the stamped PDFs by extracting text and checking for the expected email string

## Requirements

- Node.js 18 or later
- PDF templates saved beside `stamp.tsx`

## Install

```bash
npm install
```

This project depends on:

- `pdf-lib` for editing the PDF files
- `pdf-parse` for verification checks

## Configure the templates and recipients

1. Place each source PDF next to `stamp.tsx`.
2. Update `templateFiles` in `stamp.tsx` to include the files you want to stamp.
3. Update the `recipients` array inside `main()` with the target email addresses.

Example:

```ts
const templateFiles = [
  "BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf",
];

const recipients = [
  "alice@example.com",
  "bob@example.com",
];
```

## Run it

```bash
npx tsx stamp.tsx
```

The script will:

- create folders under `stamped/`
- write stamped PDF files for each template
- save a run manifest under `stamped/manifests/`
- print `FOUND` or `MISSING` messages while verifying the output

## Output structure

```text
stamped/
├── alice@example.com/
│   └── BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf
├── bob@example.com/
│   └── BasicGuide_For_EfficientAuthoring_in_Cortona3D_Rapid_Author.pdf
└── manifests/
    └── 20261107-220442.json
```

A `FOUND` result means the stamped PDF contains the expected text. A `MISSING` result means the file did not extract as expected, and you should inspect the PDF manually.

## Notes

- `pdf-parse` is pinned to `1.1.1` because newer versions can break the simple import used by this script.
- Folder names are sanitized to avoid invalid filesystem characters while keeping the recipient email readable.

## Example result

<img width="944" height="503" alt="image" src="https://github.com/user-attachments/assets/2a50710b-98f8-4542-b57e-621e99926abb" />

Video demo:

https://github.com/user-attachments/assets/6c8e45d2-5073-49d6-b791-01d61e492642
