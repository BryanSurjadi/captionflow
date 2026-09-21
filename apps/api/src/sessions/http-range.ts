export interface ByteRange {
  start: number;
  end: number;
}

export function parseByteRange(value: string, totalBytes: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || totalBytes <= 0) return null;

  const [, rawStart = "", rawEnd = ""] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, totalBytes - suffixLength), end: totalBytes - 1 };
  }

  const start = Number(rawStart);
  const requestedEnd = rawEnd ? Number(rawEnd) : totalBytes - 1;
  const end = Math.min(requestedEnd, totalBytes - 1);

  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) || start < 0 || start > end || start >= totalBytes) {
    return null;
  }

  return { start, end };
}
