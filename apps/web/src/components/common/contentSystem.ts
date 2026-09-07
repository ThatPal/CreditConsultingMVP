export type ProductRole = 'client' | 'consultant' | 'admin';

const terms: Record<string, string> = {
  CREDIT_REVIEW: 'Credit Review',
  CREDIT_PROFILE: 'Credit Profile',
  CREDIT_CENTER: 'Credit Center',
  APPLICATION_CYCLE: 'Application Cycle',
  CARD_APPLICATION_ROUND: 'Card Application Round',
  STRATEGY: 'Strategy',
  LIVE_SESSION: 'guided application session',
  ROUND_ANALYSIS: 'Round Analysis',
  MAJOR_READINESS: 'Major application coordination',
};

export function productTerm(key: keyof typeof terms) {
  return terms[key];
}

export function humanState(value: string | null | undefined) {
  if (!value) return 'Not available';
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function formatQuantity(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function formatMoney(value: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatProductDate(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options ?? { dateStyle: 'medium' }).format(new Date(value));
}

export function freshnessLabel(value: string | Date, now = new Date()) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return 'Confirmed just now';
  if (minutes < 60) return `Confirmed ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  return `Confirmed ${formatProductDate(date, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export function safeClientLabel(value: string | null | undefined) {
  if (!value) return 'Not available';
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)) return 'Reference available in details';
  return humanState(value.replace(/^SANDBOX[_ -]?/i, ''));
}

export type GovernedActionContent = {
  action: string;
  scope: string;
  effect: string;
  inFlight: string;
  reversibility: string;
  authority: string;
  evidence: string;
};

export function validateGovernedActionContent(content: GovernedActionContent) {
  return Object.entries(content)
    .filter(([, value]) => !value.trim())
    .map(([key]) => key);
}

export function isSpecificActionLabel(label: string) {
  return !/^(open|view|continue|run|enable|complete)$/i.test(label.trim());
}
