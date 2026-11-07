# Training PDF Stamper

Creates a personalised copy of each configured PDF template for every recipient, stamping their email address diagonally across every page. Each recipient gets a folder containing a copy of every template, and the script checks that every stamp was written correctly.

## Requirements

- Node.js 18 or later
- Every configured template PDF in the same folder as `stamp.tsx`

## Setup

```bash
npm install pdf-lib pdf-parse@1.1.1
npm install -D @types/pdf-parse tsx typescript
```

`pdf-parse` is pinned to 1.1.1 because later versions break simple imports.

## Usage

1. Put all the template PDFs beside `stamp.tsx`.
2. In `stamp.tsx`, add each template's filename to the `templateFiles` array. The existing guide is already listed.
3. Replace the addresses in the `recipients` array inside `main()` with your buyer list. Each address is stamped onto every listed template.
4. Run the script:

```bash
npx tsx stamp.tsx
```

3. Check the output. Each address should show `OK`. Any `MISSING` means that file's stamp didn't extract as text, so open the PDF and check it visually.

## Output

Files are written to `stamped/`, one folder per recipient, with one stamped PDF for each template:

<img width="944" height="503" alt="image" src="https://github.com/user-attachments/assets/2a50710b-98f8-4542-b57e-621e99926abb" />


https://github.com/user-attachments/assets/6c8e45d2-5073-49d6-b791-01d61e492642
