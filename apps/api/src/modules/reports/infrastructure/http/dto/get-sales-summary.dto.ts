import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_REPORT_DAYS, MAX_REPORT_DAYS } from '../../../domain/report-range';

/** Query string of `GET /reports/summary`. Unknown parameters answer 400. */
export class GetSalesSummaryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_REPORT_DAYS,
    default: DEFAULT_REPORT_DAYS,
    description: 'Calendar days (America/Bogota) to cover, ending today',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_REPORT_DAYS)
  days?: number;
}
