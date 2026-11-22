// A fingerprint of everything the CV's PDF is made from: the resume-style document that is printed
// (words, layout and print settings) and the LaTeX copy. cv-pdf.mjs saves it beside the PDF; a test
// compares, so a PDF that no longer matches the data cannot go unnoticed.
import { createHash } from 'node:crypto';
import { loadData } from '../src/data/index.js';
import { renderCvTex } from '../src/render/cv-tex.js';
import { renderCvHtml, CV_PDF_OPTIONS } from '../src/render/cv-print.js';

export const CV_PDF = 'Gautham-Sam-CV.pdf';
export const CV_TEX = 'cv/Gautham-Sam-CV.tex'; // generated; kept in git so it can be opened elsewhere
export const CV_STAMP = 'cv-pdf.stamp'; // in site/, not in public/: it is not published

export function cvFingerprint() {
  const data = loadData();
  return createHash('sha256').update(renderCvHtml(data)).update(JSON.stringify(CV_PDF_OPTIONS)).update(renderCvTex(data)).digest('hex');
}
