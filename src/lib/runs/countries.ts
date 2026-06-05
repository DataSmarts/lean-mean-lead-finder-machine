// Curated country list for the new-run form select.
// The DB stores country as free text — this list is a UX affordance, trivially extended.
export interface CountryOption {
  readonly value: string;
  readonly label: string;
}

export const COUNTRIES: CountryOption[] = [{ value: "United States", label: "United States" }];
