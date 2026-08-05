/** Digits only; US numbers normalized to last 10 digits (drop leading 1). */
export function phoneDigits(raw: string | undefined | null): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/** Regex that matches a 10-digit number with optional non-digit separators. */
export function phoneFlexibleRegex(digits10: string): RegExp | null {
  if (digits10.length !== 10 || !/^\d{10}$/.test(digits10)) return null;
  return new RegExp(digits10.split("").join("\\D*"));
}
