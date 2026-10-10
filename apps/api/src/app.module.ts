import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { ProductsModule } from './modules/products/products.module';
import { HttpKernelModule } from './shared/http/http-kernel.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [SharedModule, HttpKernelModule, HealthModule, ProductsModule],
})
export class AppModule {}
