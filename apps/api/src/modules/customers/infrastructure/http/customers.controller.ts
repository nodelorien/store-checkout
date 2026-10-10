import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DataEnvelope, toResponse } from '../../../../shared/http/responder';
import { ApiDataResponse, ApiErrorResponses } from '../../../../shared/http/swagger';
import { CustomerView } from '../../application/use-cases/customer.views';
import { GetCustomerUseCase } from '../../application/use-cases/get-customer.use-case';
import { UpsertCustomerUseCase } from '../../application/use-cases/upsert-customer.use-case';
import { CustomerResponseDto, UpsertCustomerDto } from './dto/upsert-customer.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(
    @Inject(UpsertCustomerUseCase) private readonly upsertCustomer: UpsertCustomerUseCase,
    @Inject(GetCustomerUseCase) private readonly getCustomer: GetCustomerUseCase,
  ) {}

  @Put()
  @ApiOperation({ summary: 'Create or update a customer by e-mail (idempotent)' })
  @ApiDataResponse(CustomerResponseDto, { status: 200, description: 'Existing customer updated' })
  @ApiDataResponse(CustomerResponseDto, { status: 201, description: 'Customer created' })
  @ApiErrorResponses(400, 413)
  async upsert(
    @Body() body: UpsertCustomerDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DataEnvelope<CustomerView>> {
    const result = await this.upsertCustomer.execute(body);
    return toResponse(
      result.map(({ customer, created }) => {
        response.status(created ? 201 : 200);
        return customer;
      }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one customer' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiDataResponse(CustomerResponseDto, { description: 'The customer' })
  @ApiErrorResponses(400, 404)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<DataEnvelope<CustomerView>> {
    return toResponse(await this.getCustomer.execute(id));
  }
}
