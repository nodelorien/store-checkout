import type { SalesSummary, TransactionStatus } from '@/shared/api/types';

export const RANGES = [7, 14, 30] as const;
export type RangeDays = (typeof RANGES)[number];
export const DEFAULT_RANGE: RangeDays = 14;

export const TABS = ['sales', 'products', 'payments'] as const;
export type InsightsTab = (typeof TABS)[number];
export const TAB_LABELS: Record<InsightsTab, string> = {
  sales: 'Sales',
  products: 'Products',
  payments: 'Payments',
};

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  ERROR: 'Failed',
  VOIDED: 'Voided',
  PENDING: 'Processing',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-09" → "9 Oct". Read from the text itself, so no time zone can shift the day. */
export function dayLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return MONTHS[month - 1] ? `${day} ${MONTHS[month - 1]}` : date;
}

export function percent(rate: number): string {
  const safe = Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0;
  return `${Math.round(safe * 100)}%`;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** Short money for an axis, e.g. 1 250 000 00 cents → "$1.3M". Full amounts go in tooltips. */
export function compactMoney(amountInCents: number): string {
  return `$${compact.format(Math.round(amountInCents / 100))}`;
}

/** Whether there is anything to chart in the period. */
export function hasActivity(summary: SalesSummary): boolean {
  return summary.totals.totalAttempts > 0;
}

export function parseRange(value: string | null): RangeDays {
  const days = Number(value);
  return (RANGES as readonly number[]).includes(days) ? (days as RangeDays) : DEFAULT_RANGE;
}

export function parseTab(value: string | null): InsightsTab {
  return (TABS as readonly string[]).includes(value ?? '') ? (value as InsightsTab) : 'sales';
}
