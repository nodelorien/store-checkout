import { aGatewayEvent } from '../../../../../test/builders/gateway-event.builder';
import { aProduct, PRODUCT_ID } from '../../../../../test/builders/product.builder';
import { aTransaction } from '../../../../../test/builders/transaction.builder';
import { expectErr, expectOk } from '../../../../../test/helpers/result-assertions';
import { testConfig } from '../../../../../test/helpers/test-config';
import { transactionsHarness } from '../../../../../test/helpers/transactions-harness';
import { ChecksumGatewayEventVerifier } from '../../infrastructure/gateway/checksum-gateway-event.verifier';
import { HandleGatewayEventUseCase, parseGatewayEvent } from './handle-gateway-event.use-case';

function setup(transaction = aTransaction().withGatewayId().build()) {
  const h = transactionsHarness([aProduct().withStock(5).build()]);
  h.transactionRepository.seed(transaction);
  const handle = new HandleGatewayEventUseCase(
    new ChecksumGatewayEventVerifier(testConfig()),
    h.transactionRepository,
    h.resolve,
  );
  return { h, handle };
}

describe('parseGatewayEvent', () => {
  it('AC-9: accepts a full gateway event and keeps only what is needed', () => {
    const event = expectOk(parseGatewayEvent(aGatewayEvent()));

    expect(Object.keys(event).sort()).toEqual(['data', 'event', 'signature', 'timestamp']);
    expect(event.signature.properties).toEqual([
      'transaction.id',
      'transaction.status',
      'transaction.amount_in_cents',
    ]);
  });

  it.each([
    ['event', null],
    ['event', 'text'],
    ['event', []],
    ['event', { ...aGatewayEvent(), event: '' }],
    ['data', { ...aGatewayEvent(), data: 'x' }],
    ['timestamp', { ...aGatewayEvent(), timestamp: '1530291411' }],
    ['timestamp', { ...aGatewayEvent(), timestamp: Number.NaN }],
    ['signature.properties', { ...aGatewayEvent(), signature: undefined }],
    ['signature.properties', { ...aGatewayEvent(), signature: { properties: 'x', checksum: 'c' } }],
    ['signature.properties', { ...aGatewayEvent(), signature: { properties: [], checksum: 'c' } }],
    ['signature.properties', { ...aGatewayEvent(), signature: { properties: [1], checksum: 'c' } }],
    ['signature.checksum', { ...aGatewayEvent(), signature: { properties: ['a'], checksum: 5 } }],
    ['signature.checksum', { ...aGatewayEvent(), signature: { properties: ['a'], checksum: '' } }],
  ])('AC-5: rejects a body with an invalid %s', (field, body) => {
    const error = expectErr(parseGatewayEvent(body), 'VALIDATION_ERROR');

    expect(error.details[0].field).toBe(field);
  });
});

describe('HandleGatewayEventUseCase', () => {
  it('AC-1: an authentic APPROVED event approves the transaction, decrements stock and creates the delivery', async () => {
    const { h, handle } = setup();

    const output = expectOk(await handle.execute(aGatewayEvent()));

    expect(output).toEqual({ received: true, handled: true });
    const stored = h.transactionRepository.only();
    expect(stored.status).toBe('APPROVED');
    expect(stored.deliveryId).toBeDefined();
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);
    expect(h.transactionRepository.deliveries.size).toBe(1);
  });

  it.each(['DECLINED', 'VOIDED', 'ERROR'])(
    'AC-2: an authentic %s event sets that status and leaves stock untouched',
    async (status) => {
      const { h, handle } = setup();

      const output = expectOk(
        await handle.execute(
          aGatewayEvent({ transaction: { status, status_message: 'Card declined' } }),
        ),
      );

      expect(output.handled).toBe(true);
      expect(h.transactionRepository.only().toProps()).toMatchObject({
        status,
        statusMessage: 'Card declined',
      });
      expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
      expect(h.transactionRepository.deliveries.size).toBe(0);
    },
  );

  it('AC-3: rejects a wrong checksum with INVALID_SIGNATURE and changes nothing', async () => {
    const { h, handle } = setup();

    expectErr(await handle.execute(aGatewayEvent({ secret: 'attacker' })), 'INVALID_SIGNATURE');
    expect(h.transactionRepository.only().status).toBe('PENDING');
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
  });

  it('AC-3: rejects an event whose signed status was tampered', async () => {
    const { h, handle } = setup();
    const event = aGatewayEvent({ transaction: { status: 'DECLINED' } });
    const data = event.data as { transaction: Record<string, unknown> };
    data.transaction.status = 'APPROVED';

    expectErr(await handle.execute(event), 'INVALID_SIGNATURE');
    expect(h.transactionRepository.only().status).toBe('PENDING');
  });

  it('AC-5: rejects a body that is not an event with VALIDATION_ERROR', async () => {
    const { handle } = setup();

    expectErr(await handle.execute({ hello: 'world' }), 'VALIDATION_ERROR');
  });

  it.each([
    ['another event type', aGatewayEvent({ event: 'nequi_token.updated' })],
    ['an unknown reference', aGatewayEvent({ transaction: { reference: 'TX-20261009-ZZZZZZZZ' } })],
    [
      'an amount different from the stored total',
      aGatewayEvent({ transaction: { amount_in_cents: 100 } }),
    ],
    [
      'a gateway id different from the stored one',
      aGatewayEvent({ transaction: { id: 'gw-other' } }),
    ],
    ['a non-string status', aGatewayEvent({ transaction: { status: 7 } })],
    ['a missing reference', aGatewayEvent({ transaction: { reference: undefined } })],
    ['a non-numeric amount', aGatewayEvent({ transaction: { amount_in_cents: '27030000' } })],
    ['a non-string id', aGatewayEvent({ transaction: { id: 99 } })],
    [
      'a signature that does not cover the status',
      aGatewayEvent({ properties: ['transaction.id', 'transaction.amount_in_cents'] }),
    ],
    [
      'a signature that does not cover the id',
      aGatewayEvent({ properties: ['transaction.status', 'transaction.amount_in_cents'] }),
    ],
  ])('AC-6: acknowledges but ignores an authentic event with %s', async (_name, event) => {
    const { h, handle } = setup();

    expect(expectOk(await handle.execute(event))).toEqual({ received: true, handled: false });
    expect(h.transactionRepository.only().status).toBe('PENDING');
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
  });

  it('AC-6: ignores an event for a transaction whose gateway id was never stored', async () => {
    const { h, handle } = setup(aTransaction().build());

    expect(expectOk(await handle.execute(aGatewayEvent())).handled).toBe(false);
    expect(h.transactionRepository.only().status).toBe('PENDING');
  });

  it('AC-6: a PENDING status in the event leaves the transaction PENDING', async () => {
    const { h, handle } = setup();

    expectOk(await handle.execute(aGatewayEvent({ transaction: { status: 'PENDING' } })));
    expect(h.transactionRepository.only().status).toBe('PENDING');
  });

  it('AC-7: delivering the same event twice changes nothing the second time', async () => {
    const { h, handle } = setup();
    const event = aGatewayEvent();

    expectOk(await handle.execute(event));
    const second = expectOk(await handle.execute(event));

    expect(second).toEqual({ received: true, handled: true });
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(3);
    expect(h.transactionRepository.deliveries.size).toBe(1);
  });

  it('AC-7: a late event never changes an already resolved transaction', async () => {
    const { h, handle } = setup(aTransaction().declined().build());

    expectOk(await handle.execute(aGatewayEvent()));
    expect(h.transactionRepository.only().status).toBe('DECLINED');
    expect(h.productRepository.stockOf(PRODUCT_ID)).toBe(5);
  });

  it('AC-8: propagates store failures so the gateway retries', async () => {
    const { h, handle } = setup();
    h.transactionRepository.failOn('resolveApproved');
    expectErr(await handle.execute(aGatewayEvent()), 'PERSISTENCE_ERROR');

    h.transactionRepository.failOn('findByReference');
    expectErr(await handle.execute(aGatewayEvent()), 'PERSISTENCE_ERROR');
  });
});
