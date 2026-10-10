import { ProductProps } from '../modules/products/domain/product';

const SEEDED_AT = '2026-10-09T00:00:00.000Z';

function product(
  id: string,
  slug: string,
  name: string,
  description: string,
  priceInCents: number,
  stock: number,
): ProductProps {
  return {
    id,
    name,
    description,
    priceInCents,
    currency: 'COP',
    imageUrl: `/images/products/${slug}.svg`,
    stock,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  };
}

/** Dummy catalogue. Fixed ids keep the seed idempotent; prices are COP in integer cents. */
export const SEED_PRODUCTS: readonly ProductProps[] = [
  product(
    '3f2a9c1e-5b7d-4e8a-9c21-0a1b2c3d4e01',
    'aurora-desk-lamp',
    'Aurora Desk Lamp',
    'Dimmable LED desk lamp with five colour temperatures, a touch-sensitive base and a USB-C charging port. Its folding aluminium arm fits any workspace.',
    18_990_000,
    12,
  ),
  product(
    '3f2a9c1e-5b7d-4e8a-9c21-0a1b2c3d4e02',
    'nimbus-headphones',
    'Nimbus Headphones',
    'Wireless over-ear headphones with active noise cancellation, 40 hours of battery life and memory-foam cushions for all-day listening.',
    45_990_000,
    8,
  ),
  product(
    '3f2a9c1e-5b7d-4e8a-9c21-0a1b2c3d4e03',
    'terra-backpack',
    'Terra Backpack',
    'Water-resistant 24 L backpack made from recycled fabric, with a padded 16-inch laptop sleeve and a hidden anti-theft pocket.',
    24_990_000,
    25,
  ),
  product(
    '3f2a9c1e-5b7d-4e8a-9c21-0a1b2c3d4e04',
    'pulse-smartwatch',
    'Pulse Smartwatch',
    'Fitness smartwatch with an AMOLED display, heart-rate and sleep tracking, built-in GPS and up to seven days of battery life.',
    69_990_000,
    5,
  ),
  product(
    '3f2a9c1e-5b7d-4e8a-9c21-0a1b2c3d4e05',
    'ember-coffee-grinder',
    'Ember Coffee Grinder',
    'Conical burr coffee grinder with 30 grind settings, from espresso to French press, and a quiet low-heat motor that protects the aroma.',
    32_990_000,
    1,
  ),
  product(
    '3f2a9c1e-5b7d-4e8a-9c21-0a1b2c3d4e06',
    'drift-mechanical-keyboard',
    'Drift Mechanical Keyboard',
    'Compact 75% mechanical keyboard with hot-swappable tactile switches, PBT keycaps, white backlight and Bluetooth or USB-C connection.',
    38_990_000,
    0,
  ),
];
