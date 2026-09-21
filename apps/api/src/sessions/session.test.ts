import assert from "node:assert/strict";
import test from "node:test";
import { parseByteRange } from "./http-range.js";
import { parseFrameRate } from "./media.js";

test("parses normal, open, and suffix byte ranges", () => {
  assert.deepEqual(parseByteRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(parseByteRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.equal(parseByteRange("bytes=100-101", 100), null);
});

test("parses FFprobe frame-rate fractions", () => {
  assert.equal(parseFrameRate("30000/1001").toFixed(3), "29.970");
  assert.equal(parseFrameRate("0/0"), 0);
});
