/** "+919840012345" -> "+91 98400 12345" for display; other numbers pass through. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}
