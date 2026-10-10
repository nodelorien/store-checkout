import { ApiProperty } from '@nestjs/swagger';
import { CARD_BRANDS } from '../../../../transactions/domain/card-info';
import { REPORT_STATUSES } from '../../../domain/sales-summary';

export class ReportRangeDto {
  @ApiProperty({ example: '2026-09-27', description: 'First day (America/Bogota)' })
  from!: string;

  @ApiProperty({ example: '2026-10-10', description: 'Last day = today (America/Bogota)' })
  to!: string;

  @ApiProperty({ example: 14, minimum: 1, maximum: 90 })
  days!: number;
}

export class ReportTotalsDto {
  @ApiProperty({ example: 54120000, description: 'Sum of totalInCents of APPROVED transactions' })
  revenueInCents!: number;

  @ApiProperty({ example: 3 })
  approvedOrders!: number;

  @ApiProperty({ example: 4, description: 'Units in APPROVED transactions' })
  unitsSold!: number;

  @ApiProperty({ example: 18040000, description: 'round(revenue / approvedOrders); 0 if none' })
  averageOrderInCents!: number;

  @ApiProperty({ example: 5, description: 'Every transaction in the range, any status' })
  totalAttempts!: number;

  @ApiProperty({
    example: 0.75,
    minimum: 0,
    maximum: 1,
    description: 'approved / (approved + declined + error + voided), 4 decimals; PENDING excluded',
  })
  approvalRate!: number;
}

export class SalesByDayDto {
  @ApiProperty({ example: '2026-09-27' })
  date!: string;

  @ApiProperty({ example: 0 })
  revenueInCents!: number;

  @ApiProperty({ example: 0, description: 'APPROVED transactions created that day' })
  orders!: number;
}

export class TopProductDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 'Aurora Desk Lamp', description: 'Name stored on the transaction' })
  name!: string;

  @ApiProperty({ example: 2 })
  unitsSold!: number;

  @ApiProperty({ example: 40080000 })
  revenueInCents!: number;
}

export class StatusCountDto {
  @ApiProperty({ enum: REPORT_STATUSES })
  status!: string;

  @ApiProperty({ example: 3 })
  count!: number;
}

export class CardBrandCountDto {
  @ApiProperty({ enum: CARD_BRANDS })
  brand!: string;

  @ApiProperty({ example: 4 })
  attempts!: number;

  @ApiProperty({ example: 3 })
  approved!: number;
}

export class ReportPaymentsDto {
  @ApiProperty({ type: [StatusCountDto], description: 'Always the five statuses, fixed order' })
  byStatus!: StatusCountDto[];

  @ApiProperty({ type: [CardBrandCountDto], description: 'Always VISA then MASTERCARD' })
  byCardBrand!: CardBrandCountDto[];
}

/** Aggregates only: no customer, transaction or card identifiers. */
export class SalesSummaryResponseDto {
  @ApiProperty({ example: 'COP' })
  currency!: string;

  @ApiProperty({ type: ReportRangeDto })
  range!: ReportRangeDto;

  @ApiProperty({ type: ReportTotalsDto })
  totals!: ReportTotalsDto;

  @ApiProperty({ type: [SalesByDayDto], description: 'One entry per day, oldest first' })
  salesByDay!: SalesByDayDto[];

  @ApiProperty({ type: [TopProductDto], description: 'At most 5, by revenue' })
  topProducts!: TopProductDto[];

  @ApiProperty({ type: ReportPaymentsDto })
  payments!: ReportPaymentsDto;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;
}
