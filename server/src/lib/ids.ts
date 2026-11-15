const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newInviteCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d]/g, '');
  if (digits.startsWith('62')) return `0${digits.slice(2)}`;
  if (digits.startsWith('8')) return `0${digits}`;
  return digits;
}

export function waNumber(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized.startsWith('0') ? `62${normalized.slice(1)}` : normalized;
}
