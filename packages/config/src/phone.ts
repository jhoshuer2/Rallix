/** Normalise Nigerian numbers to E.164 (+234XXXXXXXXXX). Returns null when invalid. */
export function normalizePhone(input: string): string | null {
  const d = input.replace(/[\s()-]/g, "");
  let national: string | null = null;
  if (/^\+234\d{10}$/.test(d)) national = d.slice(4);
  else if (/^234\d{10}$/.test(d)) national = d.slice(3);
  else if (/^0\d{10}$/.test(d)) national = d.slice(1);
  if (!national || !/^[789]\d{9}$/.test(national)) return null;
  return `+234${national}`;
}
