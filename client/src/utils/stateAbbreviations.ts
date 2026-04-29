export const US_STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export const US_STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_ABBR_TO_NAME).map(([abbr, name]) => [name.toLowerCase(), abbr])
);

/** Return all state-related synonyms (abbr + full name) implied by a stored state value. */
export function stateSynonyms(stored: string | null | undefined): string[] {
  if (!stored) return [];
  const trimmed = String(stored).trim();
  if (!trimmed) return [];
  const upper = trimmed.toUpperCase();
  if (US_STATE_ABBR_TO_NAME[upper]) {
    return [upper, US_STATE_ABBR_TO_NAME[upper]];
  }
  const abbr = US_STATE_NAME_TO_ABBR[trimmed.toLowerCase()];
  if (abbr) return [abbr, US_STATE_ABBR_TO_NAME[abbr]];
  return [trimmed];
}
