import { Module } from '@nestjs/common';
import { CustomersModule } from './modules/customers/customers.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentConfigModule } from './modules/payment-config/payment-config.module';
import { ProductsModule } from './modules/products/products.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { HttpKernelModule } from './shared/http/http-kernel.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    SharedModule,
    HttpKernelModule,
    HealthModule,
    ProductsModule,
    CustomersModule,
    PaymentConfigModule,
    TransactionsModule,
    DeliveriesModule,
    ReportsModule,
  ],
})
export class AppModule {}
