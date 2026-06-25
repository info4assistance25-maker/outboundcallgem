import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePhoneNumber(num: string): string {
  if (!num) return num;
  // Rimuovi spazi, trattini, punti, parentesi
  let n = String(num).trim().replace(/[\s\-\.()\/]/g, '');
  // Converti 0039 → +39
  if (n.startsWith('0039')) n = '+' + n.slice(2);
  // Aggiungi +39 se numero italiano (10 cifre, inizia con 0 o 3)
  if (/^[03]\d{9}$/.test(n)) n = '+39' + n;
  return n;
}

export function isValidPhoneNumber(num: string) {
  if (!num) return false;
  const normalized = normalizePhoneNumber(String(num).trim());
  const NUM_RE = /^\+?[0-9]{6,15}$/;
  return NUM_RE.test(normalized);
}

export function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
