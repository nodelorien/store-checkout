import { ApiProperty } from '@nestjs/swagger';

class TransactionProductDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Aurora Desk Lamp' })
  name!: string;

  @ApiProperty({ example: '/images/products/aurora-desk-lamp.svg' })
  imageUrl!: string;
}

class TransactionAmountsDto {
  @ApiProperty({ example: 18990000 })
  subtotalInCents!: number;

  @ApiProperty({ example: 250000 })
  baseFeeInCents!: number;

  @ApiProperty({ example: 800000 })
  deliveryFeeInCents!: number;

  @ApiProperty({ example: 20040000 })
  totalInCents!: number;
}

class TransactionCardDto {
  @ApiProperty({ enum: ['VISA', 'MASTERCARD'] })
  brand!: string;

  @ApiProperty({ example: '4242' })
  lastFour!: string;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'TX-20261009-7K2M9QXA', description: 'Human transaction number' })
  reference!: string;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] })
  status!: string;

  @ApiProperty({ type: String, nullable: true })
  statusMessage!: string | null;

  @ApiProperty({ type: TransactionProductDto })
  product!: TransactionProductDto;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ type: TransactionAmountsDto })
  amounts!: TransactionAmountsDto;

  @ApiProperty({ example: 'COP' })
  currency!: string;

  @ApiProperty({ type: TransactionCardDto })
  card!: TransactionCardDto;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  deliveryId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;
}
