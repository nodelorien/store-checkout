import { ApiProperty } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Aurora Desk Lamp' })
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ example: 18990000, description: 'Integer cents' })
  priceInCents!: number;

  @ApiProperty({ example: 'COP' })
  currency!: string;

  @ApiProperty({ example: '/images/products/aurora-desk-lamp.svg' })
  imageUrl!: string;

  @ApiProperty({ example: 12, minimum: 0 })
  stock!: number;
}

export class ProductStockResponseDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 12, minimum: 0 })
  stock!: number;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
