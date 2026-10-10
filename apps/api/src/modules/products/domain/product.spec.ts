import { aProduct } from '../../../../test/builders/product.builder';
import { expectErr, expectOk } from '../../../../test/helpers/result-assertions';
import { Money } from './money';
import { MAX_QUANTITY_PER_ORDER, Quantity } from './quantity';

describe('Money', () => {
  it('AC-7: accepts non-negative integer cents', () => {
    expect(expectOk(Money.of(0)).amountInCents).toBe(0);
    expect(expectOk(Money.of(12_990_000))).toMatchObject({
      amountInCents: 12_990_000,
      currency: 'COP',
    });
  });

  it.each([-1, 10.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'AC-7: rejects %p',
    (amount) => {
      expectErr(Money.of(amount), 'VALIDATION_ERROR');
    },
  );

  it('AC-7: adds and multiplies without leaving integers', () => {
    const price = expectOk(Money.of(1000));

    expect(expectOk(price.add(expectOk(Money.of(250)))).amountInCents).toBe(1250);
    expect(expectOk(price.multiply(3)).amountInCents).toBe(3000);
  });

  it.each([-1, 1.5])('AC-7: rejects multiplying by %p', (factor) => {
    expectErr(expectOk(Money.of(1000)).multiply(factor), 'VALIDATION_ERROR');
  });
});

describe('Quantity', () => {
  it.each([1, 5, MAX_QUANTITY_PER_ORDER])('AC-7: accepts %p', (value) => {
    expect(expectOk(Quantity.create(value)).value).toBe(value);
  });

  it.each([0, -1, 11, 1.5, Number.NaN])('AC-7: rejects %p', (value) => {
    const error = expectErr(Quantity.create(value), 'VALIDATION_ERROR');

    expect(error.details).toEqual([
      { field: 'quantity', message: 'quantity must be an integer between 1 and 10' },
    ]);
  });
});

describe('Product', () => {
  it('exposes its properties', () => {
    const product = aProduct().build();

    expect(product.toProps()).toEqual({
      id: product.id,
      name: product.name,
      description: product.description,
      priceInCents: product.priceInCents,
      currency: product.currency,
      imageUrl: product.imageUrl,
      stock: product.stock,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
    expect(expectOk(product.price()).amountInCents).toBe(product.priceInCents);
  });

  it('AC-8: is available when stock covers the quantity', () => {
    const product = aProduct().withStock(2).build();

    expect(expectOk(product.ensureAvailable(expectOk(Quantity.create(2))))).toBe(product);
  });

  it('AC-8: returns OUT_OF_STOCK when stock is lower than the quantity', () => {
    const product = aProduct().withStock(1).build();

    const error = expectErr(product.ensureAvailable(expectOk(Quantity.create(2))), 'OUT_OF_STOCK');

    expect(error.message).toBe('Only 1 unit left');
  });

  it('AC-8: returns OUT_OF_STOCK for a sold-out product', () => {
    const product = aProduct().withStock(0).build();

    expectErr(product.ensureAvailable(expectOk(Quantity.create(1))), 'OUT_OF_STOCK');
  });
});
