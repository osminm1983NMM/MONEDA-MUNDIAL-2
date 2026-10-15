// Enmascaramiento de presentación, no sustituye políticas RLS ni autorización.
export function maskEmail(value) {
  if (typeof value !== 'string') return '••••';
  const normalized = value.trim();
  const at = normalized.lastIndexOf('@');
  if (at < 1 || at === normalized.length - 1) return '••••';
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!/^[^\s@]+\.[^\s@]+$/.test(domain)) return '••••';
  return local[0] + '••••@' + domain;
}
