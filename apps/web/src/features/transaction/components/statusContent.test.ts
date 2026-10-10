import { canRetryPayment, statusContentFor, statusMotionFor } from './statusContent';

describe('statusContentFor', () => {
  it.each([
    ['APPROVED', 'success', 'Payment approved'],
    ['DECLINED', 'error', 'Payment declined'],
    ['ERROR', 'error', 'Payment failed'],
    ['VOIDED', 'error', 'Payment voided'],
    ['PENDING', 'info', 'Processing your payment…'],
  ] as const)('%s → %s "%s"', (status, tone, title) => {
    expect(statusContentFor({ status, statusMessage: null }, false)).toMatchObject({ tone, title });
  });

  it('shows the gateway reason of a decline', () => {
    const content = statusContentFor(
      { status: 'DECLINED', statusMessage: ' Insufficient funds ' },
      false,
    );

    expect(content.message).toBe('Insufficient funds. You have not been charged.');
  });

  it('keeps other failures generic even with a status message', () => {
    const content = statusContentFor({ status: 'ERROR', statusMessage: 'upstream 500' }, false);

    expect(content.message).toBe('We could not complete the payment. You have not been charged.');
  });

  it('says it is still processing once polling timed out', () => {
    expect(statusContentFor({ status: 'PENDING', statusMessage: null }, true)).toMatchObject({
      tone: 'warning',
      title: 'Still processing',
    });
  });

  it('ignores the polling timeout for a final status', () => {
    expect(statusContentFor({ status: 'APPROVED', statusMessage: null }, true).title).toBe(
      'Payment approved',
    );
  });
});

describe('canRetryPayment', () => {
  it.each([
    ['APPROVED', false],
    ['PENDING', false],
    ['DECLINED', true],
    ['ERROR', true],
    ['VOIDED', true],
  ] as const)('%s → %s', (status, expected) => {
    expect(canRetryPayment(status)).toBe(expected);
  });
});

describe('statusMotionFor', () => {
  it.each([
    ['success', 'draw'],
    ['error', 'nudge'],
    ['info', 'none'],
    ['warning', 'none'],
  ] as const)('animates a %s result with "%s"', (tone, expected) => {
    expect(statusMotionFor(tone, false)).toBe(expected);
  });

  it.each(['success', 'error', 'info', 'warning'] as const)(
    'AC-1: a %s result does not move when motion is reduced',
    (tone) => {
      expect(statusMotionFor(tone, true)).toBe('none');
    },
  );
});
