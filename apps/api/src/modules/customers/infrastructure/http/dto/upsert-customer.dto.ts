import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Trim } from '../../../../../shared/http/transforms';

/** Contact data of the buyer. Also nested as `customer` in the create-transaction request. */
export class UpsertCustomerDto {
  @ApiProperty({ example: 'Ada Lovelace', minLength: 3, maxLength: 100 })
  @Trim()
  @IsString()
  @Length(3, 100)
  fullName!: string;

  @ApiProperty({ example: 'ada@example.com', maxLength: 254 })
  @Trim()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: '+573001234567', pattern: '^\\+?[0-9]{7,15}$' })
  @Trim()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must match ^\\+?[0-9]{7,15}$' })
  phone!: string;
}

export class CustomerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  fullName!: string;

  @ApiProperty({ example: 'ada@example.com', description: 'Normalised (lower-cased, trimmed)' })
  email!: string;

  @ApiProperty({ example: '+573001234567' })
  phone!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
