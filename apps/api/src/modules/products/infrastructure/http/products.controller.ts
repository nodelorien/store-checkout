import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  DataEnvelope,
  ListEnvelope,
  toListResponse,
  toResponse,
} from '../../../../shared/http/responder';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPagedResponse,
} from '../../../../shared/http/swagger';
import { PageMeta } from '../../domain/catalogue-query';
import { GetProductStockUseCase } from '../../application/use-cases/get-product-stock.use-case';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case';
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case';
import { ProductStockView, ProductView } from '../../application/use-cases/product.views';
import { ListProductsDto } from './dto/list-products.dto';
import { ProductResponseDto, ProductStockResponseDto } from './dto/product.response.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    @Inject(ListProductsUseCase) private readonly listProducts: ListProductsUseCase,
    @Inject(GetProductUseCase) private readonly getProduct: GetProductUseCase,
    @Inject(GetProductStockUseCase) private readonly getProductStock: GetProductStockUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List products with their current stock',
    description:
      'Optional search, sort and paging. Without pageSize every matching product comes in one ' +
      'page. A page beyond the last one answers 200 with an empty list.',
  })
  @ApiPagedResponse(ProductResponseDto, { description: 'The catalogue page and its paging facts' })
  @ApiErrorResponses(400)
  async list(@Query() query: ListProductsDto): Promise<ListEnvelope<ProductView, PageMeta>> {
    return toListResponse(await this.listProducts.execute(query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one product' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiDataResponse(ProductResponseDto, { description: 'The product' })
  @ApiErrorResponses(400, 404)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<DataEnvelope<ProductView>> {
    return toResponse(await this.getProduct.execute(id));
  }

  @Get(':id/stock')
  @ApiOperation({ summary: 'Get the current stock of a product' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiDataResponse(ProductStockResponseDto, { description: 'The stock resource' })
  @ApiErrorResponses(400, 404)
  async stock(@Param('id', ParseUUIDPipe) id: string): Promise<DataEnvelope<ProductStockView>> {
    return toResponse(await this.getProductStock.execute(id));
  }
}
