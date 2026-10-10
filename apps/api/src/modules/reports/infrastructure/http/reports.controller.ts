import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataEnvelope, toResponse } from '../../../../shared/http/responder';
import { ApiDataResponse, ApiErrorResponses } from '../../../../shared/http/swagger';
import { GetSalesSummaryUseCase } from '../../application/use-cases/get-sales-summary.use-case';
import { SalesSummary } from '../../domain/sales-summary';
import { GetSalesSummaryDto } from './dto/get-sales-summary.dto';
import { SalesSummaryResponseDto } from './dto/sales-summary.response.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    @Inject(GetSalesSummaryUseCase) private readonly getSalesSummary: GetSalesSummaryUseCase,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Sales and payment aggregates for the last days',
    description:
      'Read-only aggregates over the transactions of the last `days` calendar days ' +
      '(America/Bogota), ending today. Contains no personal or per-order data.',
  })
  @ApiDataResponse(SalesSummaryResponseDto, { description: 'The summary' })
  @ApiErrorResponses(400)
  async summary(@Query() query: GetSalesSummaryDto): Promise<DataEnvelope<SalesSummary>> {
    return toResponse(await this.getSalesSummary.execute(query));
  }
}
