export interface CaptionWord {
  id: string;
  text: string;
  start: number;
  end: number;
  probability: number;
  hidden: boolean;
  segmentId?: number;
  edited?: boolean;
}

export interface CaptionGroup {
  id: string;
  wordIds: string[];
  start: number;
  end: number;
}

export interface CaptionData {
  version: 1;
  language: string;
  languageProbability: number;
  durationSeconds: number;
  text: string;
  words: CaptionWord[];
  groups: CaptionGroup[];
  emphasis: [];
}

interface RawWord {
  text: string;
  start: number;
  end: number;
  probability: number;
  segmentId?: number;
}

const fillerWords = new Set(["eh", "eee", "hmm", "uh", "um", "umm"]);
const danglingWords = new Set([
  "atau", "dan", "dari", "dengan", "di", "jadi", "karena", "ke", "kalau",
  "sama", "soalnya", "tapi", "untuk", "yang",
]);
const phraseStarters = new Set(["buat", "dan", "jadi", "kalau", "soalnya", "tapi", "yang"]);

export function buildCaptionData(value: unknown): CaptionData {
  if (!isRecord(value) || !Array.isArray(value.words)) {
    throw new Error("Python returned invalid transcript JSON");
  }

  const language = value.language;
  const languageProbability = value.languageProbability;
  const durationSeconds = value.durationSeconds;
  if (typeof language !== "string" || !isNumber(languageProbability) || !isNumber(durationSeconds)) {
    throw new Error("Python returned incomplete transcript metadata");
  }

  const words = normalizeWords(value.words.map(parseRawWord));
  const visibleWords = words.filter((word) => !word.hidden);
  const groups = groupWords(visibleWords);

  return {
    version: 1,
    language,
    languageProbability,
    durationSeconds,
    text: joinWords(visibleWords),
    words,
    groups,
    emphasis: [],
  };
}

export function validateCaptionData(value: unknown): CaptionData {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.words) || !Array.isArray(value.groups)) {
    throw new Error("Caption data is invalid");
  }

  const { language, languageProbability, durationSeconds } = value;
  if (typeof language !== "string" || !isNumber(languageProbability) || !isNumber(durationSeconds)) {
    throw new Error("Caption metadata is invalid");
  }

  const words = value.words.map((item, index) => parseCaptionWord(item, index));
  const wordsById = new Map(words.map((word) => [word.id, word]));
  const usedWordIds = new Set<string>();
  const groups = value.groups.map((item, index) => {
    if (!isRecord(item) || typeof item.id !== "string" || !Array.isArray(item.wordIds) || item.wordIds.length === 0) {
      throw new Error(`Caption group ${index + 1} is invalid`);
    }

    const groupedWords = item.wordIds.map((wordId) => {
      if (typeof wordId !== "string" || usedWordIds.has(wordId)) throw new Error(`Caption group ${index + 1} is invalid`);
      const word = wordsById.get(wordId);
      if (!word || word.hidden) throw new Error(`Caption group ${index + 1} is invalid`);
      usedWordIds.add(wordId);
      return word;
    });

    return {
      id: item.id,
      wordIds: groupedWords.map((word) => word.id),
      start: groupedWords[0]!.start,
      end: groupedWords.at(-1)!.end,
    };
  });

  if (usedWordIds.size !== words.filter((word) => !word.hidden).length) {
    throw new Error("Every visible caption word must belong to one group");
  }

  return {
    version: 1,
    language,
    languageProbability,
    durationSeconds,
    text: joinWords(words.filter((word) => !word.hidden)),
    words,
    groups,
    emphasis: [],
  };
}

function groupWords(words: CaptionWord[]) {
  const phrases: CaptionWord[][] = [];
  let phrase: CaptionWord[] = [];

  for (const [index, word] of words.entries()) {
    phrase.push(word);
    const next = words[index + 1];
    const boundary = !next || /[.!?]$/.test(word.text) || next.start - word.end >= 0.4 ||
      /^\p{Lu}\p{Ll}/u.test(next.text) ||
      (word.segmentId !== undefined && next.segmentId !== undefined && word.segmentId !== next.segmentId);
    if (boundary) {
      phrases.push(phrase);
      phrase = [];
    }
  }

  const chunks = phrases.flatMap(splitPhrase);
  return chunks.map((chunk, index) => ({
    id: `g${index + 1}`,
    wordIds: chunk.map((word) => word.id),
    start: chunk[0]!.start,
    end: chunk.at(-1)!.end,
  }));
}

function splitPhrase(words: CaptionWord[]) {
  const chunks: CaptionWord[][] = [];
  let remaining = words;

  while (remaining.length > 5) {
    const candidates = [3, 4, 5].filter((size) => remaining.length - size !== 1);
    const size = candidates.reduce((best, candidate) =>
      cutScore(remaining, candidate) > cutScore(remaining, best) ? candidate : best,
    candidates[0]!);
    chunks.push(remaining.slice(0, size));
    remaining = remaining.slice(size);
  }

  if (remaining.length) chunks.push(remaining);
  return chunks;
}

function cutScore(words: CaptionWord[], size: number) {
  const before = words[size - 1]!;
  const after = words[size]!;
  const endWord = cleanWord(before.text);
  const startWord = cleanWord(after.text);
  return (after.start - before.end) * 10
    - (danglingWords.has(endWord) ? 2 : 0)
    + (phraseStarters.has(startWord) ? 0.7 : 0)
    + (size === 4 ? 0.05 : 0);
}

function cleanWord(value: string) {
  return value.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function normalizeWords(values: RawWord[]) {
  const normalized: Omit<CaptionWord, "id">[] = [];

  for (const value of values) {
    const text = value.text.trim();
    if (!text) continue;

    const previous = normalized.at(-1);
    if (previous && /^[-–—'’.,!?;:%)]/.test(text)) {
      previous.text += text;
      previous.end = value.end;
      previous.probability = Math.min(previous.probability, value.probability);
      continue;
    }

    normalized.push({
      ...value,
      text,
      hidden: fillerWords.has(text.toLowerCase().replace(/[.,!?]+$/, "")),
    });
  }

  return normalized.map((word, index) => ({ ...word, id: `w${index + 1}` }));
}

function parseRawWord(value: unknown, index: number): RawWord {
  if (!isRecord(value)) throw new Error(`Transcript word ${index + 1} is invalid`);

  const { text, start, end, probability, segmentId } = value;
  if (
    typeof text !== "string" ||
    !isNumber(start) ||
    !isNumber(end) ||
    !isNumber(probability) ||
    start < 0 ||
    end <= start
  ) {
    throw new Error(`Transcript word ${index + 1} is invalid`);
  }

  if (segmentId !== undefined && !isNumber(segmentId)) throw new Error(`Transcript word ${index + 1} is invalid`);
  return { text, start, end, probability, ...(segmentId === undefined ? {} : { segmentId }) };
}

function parseCaptionWord(value: unknown, index: number): CaptionWord {
  if (!isRecord(value)) throw new Error(`Caption word ${index + 1} is invalid`);
  const { id, text, start, end, probability, hidden, segmentId, edited } = value;
  if (typeof id !== "string" || typeof text !== "string" || !text.trim() || !isNumber(start) || !isNumber(end) ||
    !isNumber(probability) || typeof hidden !== "boolean" || start < 0 || end <= start ||
    (segmentId !== undefined && !isNumber(segmentId)) || (edited !== undefined && typeof edited !== "boolean")) {
    throw new Error(`Caption word ${index + 1} is invalid`);
  }
  return {
    id,
    text: text.trim(),
    start,
    end,
    probability,
    hidden,
    ...(segmentId === undefined ? {} : { segmentId }),
    ...(edited === undefined ? {} : { edited }),
  };
}

function joinWords(words: CaptionWord[]) {
  return words.map((word) => word.text).join(" ").replace(/\s+([.,!?;:])/g, "$1");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
