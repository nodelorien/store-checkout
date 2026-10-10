import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DataEnvelope, toResponse } from '../../../../shared/http/responder';
import { ApiDataResponse, ApiErrorResponses } from '../../../../shared/http/swagger';
import { GetProductStockUseCase } from '../../application/use-cases/get-product-stock.use-case';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case';
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case';
import { ProductStockView, ProductView } from '../../application/use-cases/product.views';
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
  @ApiOperation({ summary: 'List products with their current stock' })
  @ApiDataResponse(ProductResponseDto, { isArray: true, description: 'The catalogue' })
  @ApiErrorResponses()
  async list(): Promise<DataEnvelope<ProductView[]>> {
    return toResponse(await this.listProducts.execute());
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
