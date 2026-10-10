import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../../../../shared/http/transforms';
import { UpsertCustomerDto } from '../../../../customers/infrastructure/http/dto/upsert-customer.dto';
import { DeliveryAddressDto } from '../../../../deliveries/infrastructure/http/dto/delivery-address.dto';

/**
 * Body of `POST /transactions`. There is deliberately no property for prices, fees or raw card
 * data: with `forbidNonWhitelisted` any such field (`number`, `cvc`, `expMonth`, `totalInCents`…)
 * makes the request fail with 400.
 */
export class CreateTransactionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 10, example: 1 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;

  @ApiProperty({ example: 'tok_…', maxLength: 2048, description: 'Card token from the gateway' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  cardToken!: string;

  @ApiProperty({ enum: ['VISA', 'MASTERCARD'] })
  @IsIn(['VISA', 'MASTERCARD'])
  cardBrand!: string;

  @ApiProperty({ example: '4242', pattern: '^[0-9]{4}$' })
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'cardLastFour must be 4 digits' })
  cardLastFour!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 36, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  installments: number = 1;

  @ApiProperty({ maxLength: 2048, description: 'Acceptance token from GET /payment-config' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  acceptanceToken!: string;

  @ApiProperty({ type: UpsertCustomerDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => UpsertCustomerDto)
  customer!: UpsertCustomerDto;

  @ApiProperty({ type: DeliveryAddressDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  delivery!: DeliveryAddressDto;
}
