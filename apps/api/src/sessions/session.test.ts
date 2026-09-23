import assert from "node:assert/strict";
import test from "node:test";
import { parseByteRange } from "./http-range.js";
import { parseFrameRate } from "./media.js";
import { createSessionCookieValue, readSessionAccessToken, sessionCookieName } from "./session-cookie.js";
import { buildCaptionData } from "./caption-grouping.js";

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

test("reads only the cookie belonging to the requested session", () => {
  const value = createSessionCookieValue("session-1", "secret-token");
  const header = `theme=dark; ${sessionCookieName}=${value}`;

  assert.equal(readSessionAccessToken(header, "session-1"), "secret-token");
  assert.equal(readSessionAccessToken(header, "session-2"), undefined);
  assert.equal(readSessionAccessToken(undefined, "session-1"), undefined);
});

test("normalizes and groups timed transcript words", () => {
  const captions = buildCaptionData({
    language: "id",
    languageProbability: 1,
    durationSeconds: 3,
    words: [
      { text: "Tiga", start: 0, end: 0.2, probability: 0.9 },
      { text: "alasan", start: 0.2, end: 0.4, probability: 0.9 },
      { text: "kenapa", start: 0.4, end: 0.6, probability: 0.9 },
      { text: "kalian", start: 0.6, end: 0.8, probability: 0.9 },
      { text: "umm", start: 0.81, end: 0.88, probability: 0.5 },
      { text: "harus", start: 0.9, end: 1.1, probability: 0.9 },
      { text: "di", start: 1.1, end: 1.2, probability: 0.9 },
      { text: "-color", start: 1.2, end: 1.5, probability: 0.8 },
      { text: "100", start: 1.5, end: 1.7, probability: 0.9 },
      { text: "%", start: 1.7, end: 1.8, probability: 0.9 },
      { text: "Sekarang.", start: 2.3, end: 2.7, probability: 0.9 },
    ],
  });

  assert.deepEqual(captions.words.map(({ id, text, hidden }) => ({ id, text, hidden })), [
    { id: "w1", text: "Tiga", hidden: false },
    { id: "w2", text: "alasan", hidden: false },
    { id: "w3", text: "kenapa", hidden: false },
    { id: "w4", text: "kalian", hidden: false },
    { id: "w5", text: "umm", hidden: true },
    { id: "w6", text: "harus", hidden: false },
    { id: "w7", text: "di-color", hidden: false },
    { id: "w8", text: "100%", hidden: false },
    { id: "w9", text: "Sekarang.", hidden: false },
  ]);
  assert.deepEqual(captions.groups.map((group) => group.wordIds), [
    ["w1", "w2", "w3", "w4"],
    ["w6", "w7", "w8"],
    ["w9"],
  ]);
  assert.deepEqual(captions.groups.map(({ start, end }) => ({ start, end })), [
    { start: 0, end: 0.8 },
    { start: 0.9, end: 1.8 },
    { start: 2.3, end: 2.7 },
  ]);
});

test("uses speech segments and avoids dangling connector words", () => {
  const texts = ["Banyak", "yang", "gak", "tahu", "kalau", "ini", "Metode", "feather", "berbeda"];
  const captions = buildCaptionData({
    language: "id",
    languageProbability: 1,
    durationSeconds: 2,
    words: texts.map((text, index) => ({
      text,
      start: index * 0.2,
      end: index * 0.2 + 0.18,
      probability: 0.9,
      segmentId: index < 6 ? 0 : 1,
    })),
  });

  assert.deepEqual(captions.groups.map((group) => group.wordIds), [
    ["w1", "w2", "w3", "w4"],
    ["w5", "w6"],
    ["w7", "w8", "w9"],
  ]);
});

test("uses capitalization as a boundary for legacy transcripts", () => {
  const captions = buildCaptionData({
    language: "id",
    languageProbability: 1,
    durationSeconds: 2,
    words: ["sakit", "sama", "sekali", "Bener", "banget", "deh", "Buat", "yang", "bilang", "sakit"].map((text, index) => ({
      text,
      start: index * 0.18,
      end: index * 0.18 + 0.16,
      probability: 0.9,
    })),
  });

  assert.deepEqual(captions.groups.map((group) => group.wordIds), [
    ["w1", "w2", "w3"],
    ["w4", "w5", "w6"],
    ["w7", "w8", "w9", "w10"],
  ]);
});
