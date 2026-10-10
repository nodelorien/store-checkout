import { aDelivery, AN_ADDRESS } from '../../../../test/builders/transaction.builder';
import { expectErr, expectOk } from '../../../../test/helpers/result-assertions';
import { Address } from './address';
import { Delivery } from './delivery';

const NOW = new Date('2026-10-09T16:00:00.000Z');

describe('Address', () => {
  it('accepts a complete Colombian address and trims its fields', () => {
    const address = expectOk(
      Address.create({ ...AN_ADDRESS, addressLine1: '  Cra 7 # 71-21 ', country: 'co' }),
    );

    expect(address.toProps()).toEqual(AN_ADDRESS);
  });

  it('treats empty optional fields as absent', () => {
    const address = expectOk(Address.create({ ...AN_ADDRESS, addressLine2: '  ', postalCode: '' }));

    expect(address.toProps().addressLine2).toBeUndefined();
    expect(address.toProps().postalCode).toBeUndefined();
  });

  it.each([
    ['addressLine1', { addressLine1: 'Cra' }],
    ['addressLine1', { addressLine1: 'x'.repeat(121) }],
    ['addressLine2', { addressLine2: 'x'.repeat(121) }],
    ['city', { city: 'B' }],
    ['region', { region: 'x'.repeat(61) }],
    ['country', { country: 'US' }],
    ['postalCode', { postalCode: '12' }],
    ['postalCode', { postalCode: '11-0231' }],
  ])('AC-13: rejects an invalid %s', (field, override) => {
    const error = expectErr(Address.create({ ...AN_ADDRESS, ...override }), 'VALIDATION_ERROR');

    expect(error.details.map((detail) => detail.field)).toEqual([`delivery.${field}`]);
  });

  it('AC-13: reports every invalid field at once, with a custom prefix', () => {
    const error = expectErr(Address.create({}, 'address'), 'VALIDATION_ERROR');

    expect(error.details.map((detail) => detail.field)).toEqual([
      'address.addressLine1',
      'address.city',
      'address.region',
      'address.country',
    ]);
  });
});

describe('Delivery', () => {
  const input = {
    id: 'delivery-1',
    transactionId: 'tx-1',
    customerId: 'customer-1',
    productId: 'product-1',
    quantity: 2,
    address: { ...AN_ADDRESS },
  };

  it('AC-1: is created PENDING for a transaction', () => {
    const delivery = Delivery.create(input, NOW);

    expect(delivery.toProps()).toEqual({
      ...input,
      status: 'PENDING',
      createdAt: '2026-10-09T16:00:00.000Z',
      updatedAt: '2026-10-09T16:00:00.000Z',
    });
    expect(delivery.id).toBe('delivery-1');
    expect(delivery.transactionId).toBe('tx-1');
    expect(delivery.status).toBe('PENDING');
    expect(delivery.address).toEqual(AN_ADDRESS);
  });

  it('amends the address while PENDING', () => {
    const newAddress = expectOk(Address.create({ ...AN_ADDRESS, city: 'Medellín' }));

    const amended = expectOk(aDelivery().build().amendAddress(newAddress, NOW));

    expect(amended.address.city).toBe('Medellín');
    expect(amended.toProps().updatedAt).toBe('2026-10-09T16:00:00.000Z');
    expect(amended.toProps().createdAt).toBe('2026-10-09T15:00:05.000Z');
  });

  it.each(['SHIPPED', 'DELIVERED'] as const)(
    'returns DELIVERY_NOT_EDITABLE once the delivery is %s',
    (status) => {
      const address = expectOk(Address.create(AN_ADDRESS));

      expectErr(
        aDelivery().with({ status }).build().amendAddress(address, NOW),
        'DELIVERY_NOT_EDITABLE',
      );
    },
  );
});
