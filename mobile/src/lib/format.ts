import { localeStore, t } from '@/i18n';

const loc = () => localeStore.get().locale;

export function formatRelative(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400_000],
    ['hour', 3600_000],
    ['minute', 60_000],
  ];
  try {
    const rtf = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' });
    for (const [unit, ms] of units) {
      if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit);
    }
    return rtf.format(0, 'minute');
  } catch {
    const days = Math.round(abs / 86400_000);
    return days ? `${days}d` : 'now';
  }
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  try {
    return new Date(iso).toLocaleDateString(loc(), opts);
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function formatNumber(n: number): string {
  try {
    return n.toLocaleString(loc());
  } catch {
    return String(n);
  }
}

/** "23h", "2d 4h", "35m" - time left until `iso`. */
export function formatCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '0m';
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.max(m, 1)}m`;
}

export function formatSalary(s: { min?: number; max?: number; currency: string; period: 'year' | 'month' | 'day' }): string {
  const range = s.min && s.max && s.min !== s.max ? `${formatNumber(s.min)}-${formatNumber(s.max)}` : formatNumber((s.max ?? s.min) ?? 0);
  return t('jobs.salaryStated', { range: `${s.currency} ${range}`, period: t(`jobs.period_${s.period}` as 'jobs.period_year') });
}
