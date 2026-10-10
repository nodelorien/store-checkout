import { aCustomer } from '../../../../test/builders/customer.builder';
import { expectErr, expectOk } from '../../../../test/helpers/result-assertions';
import { Email, FullName, Phone } from './contact';
import { Customer } from './customer';

const NOW = new Date('2026-10-09T15:00:00.000Z');
const contact = { fullName: 'Ada Lovelace', email: 'ada@example.com', phone: '+573001234567' };

describe('Email', () => {
  it('AC-6: normalises casing and surrounding spaces', () => {
    expect(expectOk(Email.create('  Ada@Example.COM ')).value).toBe('ada@example.com');
  });

  it.each(['', 'ada', 'ada@', '@example.com', 'ada@example', 'a b@example.com'])(
    'AC-6: rejects %p',
    (raw) => {
      expectErr(Email.create(raw), 'VALIDATION_ERROR');
    },
  );

  it('AC-6: rejects addresses longer than 254 characters and non-strings', () => {
    expectErr(Email.create(`${'a'.repeat(250)}@example.com`), 'VALIDATION_ERROR');
    expectErr(Email.create(undefined as unknown as string), 'VALIDATION_ERROR');
  });
});

describe('Phone', () => {
  it.each([
    ['+573001234567', '+573001234567'],
    ['300 123 4567', '3001234567'],
    ['(601) 555-1234', '6015551234'],
  ])('AC-6: accepts %p', (raw, expected) => {
    expect(expectOk(Phone.create(raw)).value).toBe(expected);
  });

  it.each(['', '12345', '+57abc1234567', '1234567890123456', '++573001234567'])(
    'AC-6: rejects %p',
    (raw) => {
      expectErr(Phone.create(raw), 'VALIDATION_ERROR');
    },
  );

  it('AC-6: rejects non-strings', () => {
    expectErr(Phone.create(undefined as unknown as string), 'VALIDATION_ERROR');
  });
});

describe('FullName', () => {
  it('AC-6: trims and collapses inner spaces', () => {
    expect(expectOk(FullName.create('  Ada   Lovelace ')).value).toBe('Ada Lovelace');
  });

  it('AC-6: rejects names that are too short or too long', () => {
    expectErr(FullName.create(' A '), 'VALIDATION_ERROR');
    expectErr(FullName.create('x'.repeat(101)), 'VALIDATION_ERROR');
    expectErr(FullName.create(undefined as unknown as string), 'VALIDATION_ERROR');
  });
});

describe('Customer', () => {
  it('AC-1: is created with normalised contact data and timestamps', () => {
    const customer = expectOk(
      Customer.create('id-1', { ...contact, email: ' ADA@example.com' }, NOW),
    );

    expect(customer.toProps()).toEqual({
      id: 'id-1',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+573001234567',
      createdAt: '2026-10-09T15:00:00.000Z',
      updatedAt: '2026-10-09T15:00:00.000Z',
    });
  });

  it.each([
    ['fullName', { ...contact, fullName: 'A' }],
    ['email', { ...contact, email: 'nope' }],
    ['phone', { ...contact, phone: '123' }],
  ])('AC-6: is not created with an invalid %s', (field, invalid) => {
    const error = expectErr(Customer.create('id-1', invalid, NOW), 'VALIDATION_ERROR');

    expect(error.details[0].field).toBe(field);
  });

  it('AC-2: updates name and phone, keeping id, e-mail and creation date', () => {
    const existing = aCustomer().build();

    const updated = expectOk(
      existing.updateContact(
        { fullName: 'Ada King', email: 'other@example.com', phone: '3009998877' },
        NOW,
      ),
    );

    expect(updated.toProps()).toEqual({
      ...existing.toProps(),
      fullName: 'Ada King',
      phone: '3009998877',
      updatedAt: '2026-10-09T15:00:00.000Z',
    });
    expect(updated.id).toBe(existing.id);
    expect(updated.email).toBe(existing.email);
    expect(updated.createdAt).toBe(existing.createdAt);
    expect(updated.fullName).toBe('Ada King');
    expect(updated.phone).toBe('3009998877');
    expect(updated.updatedAt).toBe('2026-10-09T15:00:00.000Z');
  });

  it('AC-6: rejects an update with invalid data', () => {
    expectErr(
      aCustomer()
        .build()
        .updateContact({ ...contact, phone: 'x' }, NOW),
      'VALIDATION_ERROR',
    );
  });
});
