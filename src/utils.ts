import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidPhoneNumber(num: string) {
  if (!num) return false;
  const NUM_RE = /^(\+?)[0-9\s\-().]{6,20}$/;
  return NUM_RE.test(String(num).trim());
}

export function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
