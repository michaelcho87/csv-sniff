/**
 * Sniff a CSV sample: delimiter, quote character, line ending, and whether the first
 * row is a header. Says how sure it is, and why.
 *
 * Every "just split on comma" importer breaks on the first European export (semicolons,
 * decimal commas) or the first TSV. Guessing silently is worse than asking, so this
 * returns a confidence and reasons; treat anything under ~0.6 as "ask the user".
 *
 *   sniffCsv("a;b;c\n1;2;3\n")  → { delimiter: ";", quote: '"', lineEnding: "\n", hasHeader: true, confidence: 0.9, ... }
 */
const CANDIDATES = [",", ";", "\t", "|"];

export function sniffCsv(sample, options = {}) {
  if (typeof sample !== "string") throw new TypeError("sniffCsv: expected a string sample");
  const maxLines = options.maxLines ?? 50;
  const reasons = [];
  const lineEnding = sample.includes("\r\n") ? "\r\n" : "\n";
  const lines = sample.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, maxLines);
  if (lines.length === 0) return { delimiter: null, quote: null, lineEnding, hasHeader: false, confidence: 0, reasons: ["empty sample"] };

  // Delimiter: the candidate whose per-line count is most consistent (and non-zero).
  let best = { delimiter: null, score: -1, counts: [] };
  for (const d of CANDIDATES) {
    const counts = lines.map((l) => countOutsideQuotes(l, d));
    const nonZero = counts.filter((c) => c > 0).length;
    if (nonZero === 0) continue;
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, c) => a + (c - mean) ** 2, 0) / counts.length;
    // consistency first, then more columns
    const score = (nonZero / counts.length) * (1 / (1 + variance)) + Math.min(mean, 10) / 100;
    if (score > best.score) best = { delimiter: d, score, counts };
  }
  if (!best.delimiter) return { delimiter: null, quote: null, lineEnding, hasHeader: false, confidence: 0.1, reasons: ["no candidate delimiter appears in the sample"] };
  const consistent = best.counts.every((c) => c === best.counts[0]);
  reasons.push(`${JSON.stringify(best.delimiter)} appears ${best.counts[0]}× per line${consistent ? " on every line" : " (uneven)"}`);

  // Quote: whichever of " and ' actually wraps fields on this delimiter.
  const quote = ['"', "'"].find((q) => lines.some((l) => new RegExp(`(^|\\${best.delimiter})\\s*${q}[^${q}]*${q}\\s*(\\${best.delimiter}|$)`).test(l))) ?? '"';

  // Header: first row is header-like when its cells are non-numeric and later rows have numbers
  // in those columns, or when its cells are unique words and the second row is not.
  const first = splitLine(lines[0], best.delimiter, quote);
  const second = lines[1] ? splitLine(lines[1], best.delimiter, quote) : null;
  let hasHeader = false;
  if (second) {
    const firstNumeric = first.filter(isNumeric).length;
    const secondNumeric = second.filter(isNumeric).length;
    if (firstNumeric === 0 && secondNumeric > 0) { hasHeader = true; reasons.push("first row has no numbers where later rows do"); }
    else if (firstNumeric === 0 && new Set(first.map((c) => c.toLowerCase())).size === first.length && first.every((c) => c.length > 0 && c.length <= 40)) { hasHeader = true; reasons.push("first row is unique short labels"); }
    else reasons.push("first row looks like data");
  } else reasons.push("single line: header unknowable");

  let confidence = consistent ? 0.9 : 0.6;
  if (lines.length < 3) confidence -= 0.2;
  if (best.counts[0] === 1) confidence -= 0.1;
  return { delimiter: best.delimiter, quote, lineEnding, hasHeader, confidence: Math.max(0, Math.round(confidence * 100) / 100), reasons };
}

function countOutsideQuotes(line, d) {
  let n = 0, inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch === d) n++;
  }
  return n;
}

export function splitLine(line, d, q = '"') {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === q) { if (inQ && line[i + 1] === q) { cur += q; i++; } else inQ = !inQ; }
    else if (!inQ && ch === d) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function isNumeric(s) { return /^-?\d+([.,]\d+)?%?$/.test(s.trim()); }
