export function safeReturnPath(value: unknown, fallback = '/client/overview') {
  if (typeof value !== 'string' || !value) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\'))
    return fallback;
  try {
    const url = new URL(decoded, 'https://internal.invalid');
    return url.origin === 'https://internal.invalid'
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
