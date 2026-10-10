import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Trim } from '../../../../../shared/http/transforms';
import {
  DEFAULT_PRODUCT_SORT,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  PRODUCT_SORTS,
} from '../../../domain/catalogue-query';

/** Query string of `GET /products`. Every parameter is optional; unknown ones answer 400. */
export class ListProductsDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Ignored without pageSize' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    description: 'Absent = no pagination: every matching product in one page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;

  @ApiPropertyOptional({
    maxLength: MAX_SEARCH_LENGTH,
    description: 'Case-insensitive substring of the name or the description',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  search?: string;

  @ApiPropertyOptional({ enum: PRODUCT_SORTS, default: DEFAULT_PRODUCT_SORT })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: string;
}
