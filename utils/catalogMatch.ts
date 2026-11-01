/**
 * Catalog match verification.
 *
 * The catalog service is searched by title text, so a hit is only a candidate:
 * the same name can be a remake, a localized entry, or an unrelated title.
 * These helpers compare a candidate's details (year, cast, director/creator)
 * against the expected TMDB metadata so the resolver can confirm a hit before
 * playing it.
 *
 * Everything here is pure and import-free so the rules can be exercised
 * without the network.
 */

/** Release years within this distance are treated as the same title. */
export const MATCH_YEAR_TOLERANCE = 1;

/** Lowercase alphanumeric form used for titles and person names. */
export const normalizeMatchText = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Parse a year out of a date field ("2016", "2016-07-15", 2016). */
export const parseMatchYear = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  if (typeof value !== 'string') return null;
  const match = value.match(/\d{4}/);
  return match ? Number(match[0]) : null;
};

/** Split a comma-separated catalog people field ("A, B, C") into names. */
export const parseCatalogNames = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
};

/** How many distinct expected names appear in the catalog list. */
export const countNameOverlap = (catalogNames: string[], expectedNames: string[]): number => {
  const catalogSet = new Set(catalogNames.map(normalizeMatchText).filter(Boolean));
  if (catalogSet.size === 0) return 0;

  const expectedSet = new Set(expectedNames.map(normalizeMatchText).filter(Boolean));
  let overlap = 0;
  for (const name of expectedSet) {
    if (catalogSet.has(name)) overlap += 1;
  }
  return overlap;
};

/** Expected metadata for a title, taken from TMDB. */
export interface CatalogMatchCriteria {
  /** Release year (movie release_date / TV first_air_date). */
  year?: number | null;
  /** Top-billed cast names. */
  castNames?: string[];
  /** Movie directors, or TV creators. */
  directorNames?: string[];
}

/** The catalog's own metadata for a candidate, as returned by details. */
export interface CatalogMatchSource {
  year?: string | null;
  cast?: string | null;
  director?: string | null;
  creator?: string | null;
}

export interface CatalogMatchEvaluation {
  /**
   * `true` when the candidate agreed with the expected metadata, `false` when
   * there was evidence against it, and `null` when there was nothing to check
   * (no criteria), which keeps the original title-only behavior.
   */
  verified: boolean | null;
  /** null when either side has no year to compare. */
  yearAgree: boolean | null;
  castOverlap: number;
  directorOverlap: number;
}

/**
 * Decide whether a candidate's details agree with the expected metadata.
 *
 * Rules, strongest first:
 *  1. Two or more shared cast members — a strong signal on its own.
 *  2. An agreeing year plus at least one shared person (cast or director/creator).
 *  3. An agreeing year when the comparison is impossible: the service returned
 *     no people at all, or we only have a year to check.
 *
 * Results are deliberately three-state:
 *  - `true`  — compared and agreed.
 *  - `false` — compared and disagreed (e.g. a remake with a different year).
 *  - `null`  — nothing to compare: no criteria were supplied, **or** the
 *    catalog entry exposed no year/people at all. Absence of evidence must not
 *    be reported as disagreement.
 */
export const evaluateCatalogMatch = (
  details: CatalogMatchSource,
  criteria?: CatalogMatchCriteria | null
): CatalogMatchEvaluation => {
  const expectedYear = criteria?.year ?? null;
  const expectedCast = criteria?.castNames ?? [];
  const expectedDirectors = criteria?.directorNames ?? [];

  const catalogCast = parseCatalogNames(details.cast);
  const catalogDirectors = [
    ...parseCatalogNames(details.director),
    ...parseCatalogNames(details.creator),
  ];
  const catalogYear = parseMatchYear(details.year);

  const yearAgree =
    expectedYear != null && catalogYear != null
      ? Math.abs(catalogYear - expectedYear) <= MATCH_YEAR_TOLERANCE
      : null;
  const castOverlap = countNameOverlap(catalogCast, expectedCast);
  const directorOverlap = countNameOverlap(catalogDirectors, expectedDirectors);

  const hasCriteria =
    expectedYear != null || expectedCast.length > 0 || expectedDirectors.length > 0;
  if (!hasCriteria) {
    return { verified: null, yearAgree, castOverlap, directorOverlap };
  }

  const yearOnlyCriteria = expectedCast.length === 0 && expectedDirectors.length === 0;
  const hasCatalogPeople = catalogCast.length > 0 || catalogDirectors.length > 0;

  // Sparse catalog entry: criteria exist, but this candidate exposes nothing to
  // compare. That is absence of evidence, not disagreement, so report it as
  // unchecked rather than accusing a match we never actually tested.
  const hasCatalogEvidence = catalogYear != null || hasCatalogPeople;
  if (!hasCatalogEvidence) {
    return { verified: null, yearAgree, castOverlap, directorOverlap };
  }

  const verified =
    castOverlap >= 2 ||
    (yearAgree === true && (castOverlap >= 1 || directorOverlap >= 1)) ||
    (yearAgree === true && (yearOnlyCriteria || !hasCatalogPeople));

  return { verified, yearAgree, castOverlap, directorOverlap };
};

export interface CatalogHitLike {
  id: string;
  title: string;
  ott?: string;
  kindHint?: 'm' | 't' | null;
  year?: string | null;
}

/** Title agreement tiers: exact, prefix, substring, reverse substring, other. */
export const scoreTitleMatch = (catalogTitle: string, targetTitle: string): number => {
  const normalizedHit = normalizeMatchText(catalogTitle);
  const normalizedTarget = normalizeMatchText(targetTitle);
  if (!normalizedHit || !normalizedTarget) return 0;

  if (normalizedHit === normalizedTarget) return 1000;
  if (normalizedHit.startsWith(normalizedTarget)) return 600;
  if (normalizedHit.includes(normalizedTarget)) return 300;
  if (normalizedTarget.includes(normalizedHit)) return 150;
  return 10;
};

/**
 * Order hits best-first: title agreement, then the namespace's kind hint,
 * then year agreement when both sides have one, then the default namespace.
 */
export const rankCatalogHits = <T extends CatalogHitLike>(
  hits: readonly T[],
  targetTitle: string,
  wantedKind: 'm' | 't' | null,
  criteria?: CatalogMatchCriteria | null
): T[] => {
  const expectedYear = criteria?.year ?? null;

  const scoreHit = (hit: T): number => {
    let score = scoreTitleMatch(hit.title, targetTitle);

    if (wantedKind && hit.kindHint) {
      score += hit.kindHint === wantedKind ? 120 : -120;
    }

    const hitYear = parseMatchYear(hit.year);
    if (expectedYear != null && hitYear != null) {
      score += Math.abs(hitYear - expectedYear) <= MATCH_YEAR_TOLERANCE ? 80 : -80;
    }

    if (hit.ott === 'nf') score += 5;

    return score;
  };

  return [...hits].sort((a, b) => scoreHit(b) - scoreHit(a));
};
