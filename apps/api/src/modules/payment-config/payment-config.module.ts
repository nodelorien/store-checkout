import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../shared/config/app-config';
import { PaymentGatewayModule } from '../transactions/infrastructure/gateway/payment-gateway.module';
import {
  PAYMENT_PUBLIC_CONFIG,
  PaymentPublicConfig,
} from './application/ports/payment-public-config.port';
import { GetPaymentConfigUseCase } from './application/use-cases/get-payment-config.use-case';
import { PaymentConfigController } from './infrastructure/http/payment-config.controller';

export function toPaymentPublicConfig(config: AppConfig): PaymentPublicConfig {
  return {
    publicKey: config.gateway.publicKey,
    tokenizationUrl: `${config.gateway.baseUrl}/tokens/cards`,
    currency: 'COP',
  };
}

@Module({
  imports: [PaymentGatewayModule],
  controllers: [PaymentConfigController],
  providers: [
    { provide: PAYMENT_PUBLIC_CONFIG, inject: [APP_CONFIG], useFactory: toPaymentPublicConfig },
    GetPaymentConfigUseCase,
  ],
})
export class PaymentConfigModule {}
