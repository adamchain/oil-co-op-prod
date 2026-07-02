// Format a phone number as "(860) 593-6089".
// 11-digit US numbers starting with 1 render as "+1 (860) 593-6089".
// Anything that isn't a recognizable US number is returned trimmed, unchanged.
export function formatPhoneValue(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1"))
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw.trim();
}
