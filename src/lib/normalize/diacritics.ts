/**
 * Fold Croatian diacritics to their ASCII base for COMPARISON ONLY.
 * Never mutate stored display values with this — it is a matching aid.
 * č→c, ć→c, đ→d, š→s, ž→z (and uppercase variants).
 */
const MAP: Record<string, string> = {
  č: "c",
  ć: "c",
  đ: "d",
  š: "s",
  ž: "z",
  Č: "C",
  Ć: "C",
  Đ: "D",
  Š: "S",
  Ž: "Z",
};

export function foldCroatian(input: string): string {
  let out = input.replace(/[čćđšžČĆĐŠŽ]/g, (ch) => MAP[ch] ?? ch);
  // Also strip any remaining combining marks (NFD) as a safety net.
  out = out.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return out;
}
