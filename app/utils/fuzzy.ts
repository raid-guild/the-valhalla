const WORD_SEPARATORS = new Set([" ", "-", "_", "/", "."]);

export function fuzzyScore(query: string, candidate: string) {
  const needle = query.trim().toLocaleLowerCase();
  const haystack = candidate.toLocaleLowerCase();

  if (!needle) return 0;

  const exactIndex = haystack.indexOf(needle);
  if (exactIndex !== -1) {
    return 1000 - exactIndex * 2 - (haystack.length - needle.length) * 0.01;
  }

  let score = 0;
  let searchFrom = 0;
  let previousMatch = -2;

  for (const character of needle) {
    const matchIndex = haystack.indexOf(character, searchFrom);
    if (matchIndex === -1) return null;

    score += 10;

    if (
      matchIndex === 0 ||
      WORD_SEPARATORS.has(haystack[matchIndex - 1] || "")
    ) {
      score += 8;
    }

    if (matchIndex === previousMatch + 1) {
      score += 12;
    } else if (previousMatch >= 0) {
      score -= Math.min(matchIndex - previousMatch - 1, 8);
    }

    previousMatch = matchIndex;
    searchFrom = matchIndex + 1;
  }

  return score - haystack.length * 0.01;
}
