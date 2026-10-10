import { ApiProperty, PartialType } from '@nestjs/swagger';
import { DeliveryAddressDto } from './delivery-address.dto';

/** Body of `PATCH /deliveries/:id`: any subset of the address fields (at least one). */
export class UpdateDeliveryAddressDto extends PartialType(DeliveryAddressDto) {}

class DeliveryAddressResponseDto {
  @ApiProperty({ example: 'Cra 7 # 71-21' })
  addressLine1!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Apto 501' })
  addressLine2!: string | null;

  @ApiProperty({ example: 'Bogotá' })
  city!: string;

  @ApiProperty({ example: 'Cundinamarca' })
  region!: string;

  @ApiProperty({ example: 'CO' })
  country!: string;

  @ApiProperty({ type: String, nullable: true, example: '110231' })
  postalCode!: string | null;
}

export class DeliveryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  transactionId!: string;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ example: 1 })
  quantity!: number;

  @ApiProperty({ type: DeliveryAddressResponseDto })
  address!: DeliveryAddressResponseDto;

  @ApiProperty({ enum: ['PENDING', 'SHIPPED', 'DELIVERED'] })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
