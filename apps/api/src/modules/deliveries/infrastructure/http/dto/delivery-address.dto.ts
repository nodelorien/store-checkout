import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Trim } from '../../../../../shared/http/transforms';

/** Delivery address (shape rules of `api.md`). Nested as `delivery` in the create-transaction request. */
export class DeliveryAddressDto {
  @ApiProperty({ example: 'Cra 7 # 71-21', minLength: 5, maxLength: 120 })
  @Trim()
  @IsString()
  @Length(5, 120)
  addressLine1!: string;

  @ApiPropertyOptional({ example: 'Apto 501', maxLength: 120 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  addressLine2?: string;

  @ApiProperty({ example: 'Bogotá', minLength: 2, maxLength: 60 })
  @Trim()
  @IsString()
  @Length(2, 60)
  city!: string;

  @ApiProperty({ example: 'Cundinamarca', minLength: 2, maxLength: 60 })
  @Trim()
  @IsString()
  @Length(2, 60)
  region!: string;

  @ApiProperty({ example: 'CO', enum: ['CO'] })
  @Trim()
  @IsIn(['CO'])
  country!: string;

  @ApiPropertyOptional({ example: '110231', pattern: '^[A-Za-z0-9]{4,10}$' })
  @IsOptional()
  @Trim()
  @IsString()
  @Matches(/^[A-Za-z0-9]{4,10}$/, { message: 'postalCode must have 4 to 10 letters or digits' })
  postalCode?: string;
}
