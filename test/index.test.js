import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffCsv, splitLine } from "../src/index.js";

test("plain comma CSV with header", () => {
  const r = sniffCsv("name,age,city\nAda,36,London\nLin,29,Taipei\n");
  assert.equal(r.delimiter, ",");
  assert.equal(r.hasHeader, true);
  assert.ok(r.confidence >= 0.8, String(r.confidence));
});

test("European semicolon export with decimal commas", () => {
  const r = sniffCsv("artikel;preis;menge\nSchraube;1,25;100\nMutter;0,80;250\n");
  assert.equal(r.delimiter, ";");
  assert.equal(r.hasHeader, true);
});

test("TSV and pipe", () => {
  assert.equal(sniffCsv("a\tb\tc\n1\t2\t3\n").delimiter, "\t");
  assert.equal(sniffCsv("a|b|c\n1|2|3\n4|5|6\n").delimiter, "|");
});

test("commas inside quotes do not confuse the count", () => {
  const r = sniffCsv('id,note,amount\n1,"hello, world",5\n2,"a, b, c",6\n');
  assert.equal(r.delimiter, ",");
  assert.equal(r.quote, '"');
  assert.deepEqual(splitLine('1,"hello, world",5', ",", '"'), ["1", "hello, world", "5"]);
  assert.deepEqual(splitLine('x,"say ""hi""",y', ",", '"'), ["x", 'say "hi"', "y"]);
});

test("no header when the first row is data", () => {
  const r = sniffCsv("1,2,3\n4,5,6\n7,8,9\n");
  assert.equal(r.hasHeader, false);
});

test("CRLF detected; uneven rows lower confidence; garbage is low confidence", () => {
  assert.equal(sniffCsv("a,b\r\n1,2\r\n").lineEnding, "\r\n");
  const uneven = sniffCsv("a,b,c\n1,2\n3,4,5,6\n");
  assert.ok(uneven.confidence < 0.8);
  const junk = sniffCsv("just some words\nand more words\n");
  assert.ok(junk.confidence <= 0.6, String(junk.confidence));
  assert.equal(sniffCsv("").confidence, 0);
});
