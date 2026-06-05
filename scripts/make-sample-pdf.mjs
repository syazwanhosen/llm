// Generates samples/llm-handbook.pdf — a small, uncompressed, text-layer PDF
// used as the default document for "chat with your PDF". No dependencies: it
// writes raw PDF objects and computes correct xref byte offsets so the text
// layer extracts cleanly via PDFLoader (pdf.js). Regenerate with:
//   node scripts/make-sample-pdf.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const page1 = [
  "Acme Corp Remote Work Handbook",
  "2026 Edition",
  " ",
  "Welcome to Acme Corp. This handbook explains our remote work policy. It",
  "applies to all full-time employees and is reviewed each year by the People",
  "team.",
  " ",
  "1. Eligibility",
  "Full-time employees become eligible for remote work after their first 90",
  "days of employment. Contractors and interns require manager approval before",
  "working remotely.",
  " ",
  "2. Remote Schedule",
  "Employees may work remotely up to 3 days per week. Working remotely for more",
  "than 3 days in a week requires written approval from your direct manager.",
  " ",
  "3. Core Hours",
  "All employees must be available during core hours of 10:00 AM to 4:00 PM in",
  "their local time zone. Outside core hours you may arrange your schedule as",
  "needed to complete your work.",
];

const page2 = [
  "Acme Corp Remote Work Handbook (continued)",
  " ",
  "4. Equipment and Expenses",
  "Acme provides a home office equipment stipend of $500 per year. Employees",
  "may also claim an internet reimbursement of $40 per month with a receipt.",
  " ",
  "5. Security",
  "A company VPN is required when accessing internal systems from home. Using a",
  "password manager is mandatory. Confidential work must never be done over",
  "public Wi-Fi networks.",
  " ",
  "6. Meetings",
  "Cameras are optional during video meetings. Meeting recordings are stored",
  "for 90 days and then automatically deleted.",
  " ",
  "7. Time Off",
  "Employees receive 20 days of paid time off (PTO) per year. Please request",
  "PTO at least 2 weeks in advance through the HR portal.",
  " ",
  "8. Contacts",
  "For technical help, email it-help@acme.example. For policy questions,",
  "contact the People team at people@acme.example.",
];

const escape = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function contentStream(lines) {
  let s = "BT\n/F1 11 Tf\n72 720 Td\n15 TL\n";
  for (const line of lines) s += `(${escape(line)}) Tj\nT*\n`;
  s += "ET";
  return s;
}

const c1 = contentStream(page1);
const c2 = contentStream(page2);

// Object 0 is the free-list head; objects 1..7 are real.
const objects = [
  null,
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
  `<< /Length ${Buffer.byteLength(c1)} >>\nstream\n${c1}\nendstream`,
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
  `<< /Length ${Buffer.byteLength(c2)} >>\nstream\n${c2}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];

let pdf = "%PDF-1.4\n";
const offsets = [];
for (let i = 1; i < objects.length; i++) {
  offsets[i] = Buffer.byteLength(pdf);
  pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
}

const xrefStart = Buffer.byteLength(pdf);
const size = objects.length; // 8 entries: 0 (free) + 1..7
pdf += `xref\n0 ${size}\n`;
pdf += "0000000000 65535 f \n";
for (let i = 1; i < size; i++) {
  pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

mkdirSync("samples", { recursive: true });
writeFileSync("samples/llm-handbook.pdf", Buffer.from(pdf, "latin1"));
console.log(`Wrote samples/llm-handbook.pdf (${Buffer.byteLength(pdf)} bytes, 2 pages).`);
