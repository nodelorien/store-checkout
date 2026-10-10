import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CREATE_TRANSACTION_RATE_LIMIT } from '../../../../shared/http/http-kernel.module';
import { DataEnvelope, toResponse } from '../../../../shared/http/responder';
import { ApiDataResponse, ApiErrorResponses } from '../../../../shared/http/swagger';
import { CreateTransactionUseCase } from '../../application/use-cases/create-transaction.use-case';
import { GetTransactionUseCase } from '../../application/use-cases/get-transaction.use-case';
import { TransactionView } from '../../application/use-cases/transaction.views';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionResponseDto } from './dto/transaction.response.dto';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(CreateTransactionUseCase) private readonly createTransaction: CreateTransactionUseCase,
    @Inject(GetTransactionUseCase) private readonly getTransaction: GetTransactionUseCase,
  ) {}

  @Post()
  @Throttle({ default: CREATE_TRANSACTION_RATE_LIMIT })
  @ApiOperation({
    summary: 'Create a transaction (PENDING), charge the card and return the current state',
    description:
      'A declined card is not an error: the answer is 201 with status DECLINED. ' +
      'Prices and fees are computed by the server.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'A repeated key returns the original transaction (200) instead of charging twice',
  })
  @ApiDataResponse(TransactionResponseDto, { status: 201, description: 'Transaction created' })
  @ApiDataResponse(TransactionResponseDto, {
    status: 200,
    description: 'Idempotency-Key replay: the original transaction',
  })
  @ApiErrorResponses(400, 404, 409, 413, 422, 502)
  async create(
    @Body() body: CreateTransactionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DataEnvelope<TransactionView>> {
    const result = await this.createTransaction.execute({ ...body, idempotencyKey });
    return toResponse(
      result.map(({ transaction, replayed }) => {
        response.status(replayed ? 200 : 201);
        return transaction;
      }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transaction (reconciles with the gateway while PENDING)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiDataResponse(TransactionResponseDto, { description: 'The transaction' })
  @ApiErrorResponses(400, 404)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<DataEnvelope<TransactionView>> {
    return toResponse(await this.getTransaction.execute(id));
  }
}
