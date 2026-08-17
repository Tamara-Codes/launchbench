/** Build one Google Places text-search query inside the selected territory. */
export function buildGooglePlacesQuery(
  rawTerm: string,
  town: string,
  country: string,
): string {
  const term = rawTerm.trim();
  const territory = `${town.trim()}, ${country.trim()}`;
  const usesTerritory = term.includes("{territory}");
  const usesTown = term.includes("{town}");
  const rendered = term
    .replace(/\{territory\}/g, territory)
    .replace(/\{town\}/g, town.trim());

  if (usesTerritory) return rendered;
  if (usesTown) return `${rendered}, ${country.trim()}`;
  return `${rendered} in ${territory}`;
}
