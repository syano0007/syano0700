function frontendRemoveTashkeel(str: string): string {
  return str.replace(/[\u064B-\u065F]/g, "");
}

function frontendNormalizeArabic(str: string): string {
  return str
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

export interface HighlightSegment {
  part: string;
  highlight: boolean;
}

export function highlightMatch(text: string, query: string): HighlightSegment[] {
  if (!query || !text) return [{ part: text, highlight: false }];

  const normalizedQuery = frontendNormalizeArabic(frontendRemoveTashkeel(query))
    .toLowerCase()
    .trim();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [{ part: text, highlight: false }];

  const normalizedText = frontendNormalizeArabic(frontendRemoveTashkeel(text)).toLowerCase();

  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let idx = 0;
    while (idx < normalizedText.length) {
      const pos = normalizedText.indexOf(term, idx);
      if (pos === -1) break;
      ranges.push([pos, pos + term.length]);
      idx = pos + 1;
    }
  }

  if (ranges.length === 0) return [{ part: text, highlight: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    if (merged.length > 0 && start <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end);
    } else {
      merged.push([start, end]);
    }
  }

  const result: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) result.push({ part: text.slice(cursor, start), highlight: false });
    result.push({ part: text.slice(start, end), highlight: true });
    cursor = end;
  }
  if (cursor < text.length) result.push({ part: text.slice(cursor), highlight: false });
  return result;
}
