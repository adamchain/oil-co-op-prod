/**
 * Annual billing is June 1. If signup is after June 1, first annual bill is the following June 1.
 * Signup on June 1 or earlier in the year → first annual bill is June 1 of the same year
 * (if that date is still in the future at signup; otherwise next year — handled by caller).
 */
export function nextJuneFirstAfterSignup(signupDate: Date): Date {
  const y = signupDate.getFullYear();
  const june1 = new Date(Date.UTC(y, 5, 1, 12, 0, 0));
  const signupUtc = new Date(
    Date.UTC(
      signupDate.getFullYear(),
      signupDate.getMonth(),
      signupDate.getDate(),
      12,
      0,
      0
    )
  );
  if (signupUtc.getTime() > june1.getTime()) {
    return new Date(Date.UTC(y + 1, 5, 1, 12, 0, 0));
  }
  return june1;
}

/** After a June 1 annual bill, advance to next year's June 1. */
export function followingJuneFirst(fromDate: Date): Date {
  const y = fromDate.getUTCFullYear();
  return new Date(Date.UTC(y + 1, 5, 1, 12, 0, 0));
}

export function daysUntil(target: Date, from: Date = new Date()): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

export function juneFirstYear(year: number): Date {
  return new Date(Date.UTC(year, 5, 1, 12, 0, 0));
}
