import type { Transaction, TransactionStatus } from '@/shared/api/types';

export interface StatusContent {
  tone: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

const CONTENT: Record<TransactionStatus, StatusContent> = {
  APPROVED: {
    tone: 'success',
    title: 'Payment approved',
    message: 'Thank you! Your order is confirmed and on its way to being prepared.',
  },
  DECLINED: {
    tone: 'error',
    title: 'Payment declined',
    message: 'Your card was declined. You have not been charged.',
  },
  ERROR: {
    tone: 'error',
    title: 'Payment failed',
    message: 'We could not complete the payment. You have not been charged.',
  },
  VOIDED: {
    tone: 'error',
    title: 'Payment voided',
    message: 'This payment was cancelled. You have not been charged.',
  },
  PENDING: {
    tone: 'info',
    title: 'Processing your payment…',
    message: 'This usually takes a few seconds. Please keep this page open.',
  },
};

const STILL_PROCESSING: StatusContent = {
  tone: 'warning',
  title: 'Still processing',
  message: 'Your payment is taking longer than usual. You can check again in a moment.',
};

/** Copy and tone for a transaction. Pure, so the status rules are testable without rendering. */
export function statusContentFor(
  transaction: Pick<Transaction, 'status' | 'statusMessage'>,
  pollingTimedOut: boolean,
): StatusContent {
  if (transaction.status === 'PENDING' && pollingTimedOut) return STILL_PROCESSING;

  const content = CONTENT[transaction.status];
  // Only a decline carries a reason worth showing; other failures stay generic.
  if (transaction.status === 'DECLINED' && transaction.statusMessage?.trim()) {
    return {
      ...content,
      message: `${transaction.statusMessage.trim()}. You have not been charged.`,
    };
  }
  return content;
}

export type StatusMotion = 'draw' | 'nudge' | 'none';

/**
 * Motion of the result icon: drawn in on success, one short nudge on failure. A payment still in
 * progress keeps its spinner, and nothing moves when the customer asked for reduced motion.
 */
export function statusMotionFor(tone: StatusContent['tone'], reducedMotion: boolean): StatusMotion {
  if (reducedMotion) return 'none';
  if (tone === 'success') return 'draw';
  return tone === 'error' ? 'nudge' : 'none';
}

export function canRetryPayment(status: TransactionStatus): boolean {
  return status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED';
}
