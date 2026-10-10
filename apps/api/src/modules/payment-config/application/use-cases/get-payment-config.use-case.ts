import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/errors/domain-error';
import { FEES_CONFIG, FeesConfig } from '../../../../shared/ports/fees-config.port';
import { fromResult, Result } from '../../../../shared/result/result';
import {
  PAYMENT_GATEWAY_PORT,
  PaymentGatewayPort,
} from '../../../transactions/application/ports/payment-gateway.port';
import { PAYMENT_PUBLIC_CONFIG, PaymentPublicConfig } from '../ports/payment-public-config.port';

export interface PaymentConfigView {
  readonly publicKey: string;
  readonly tokenizationUrl: string;
  readonly acceptance: { readonly token: string; readonly permalink: string };
  readonly currency: string;
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
}

@Injectable()
export class GetPaymentConfigUseCase {
  constructor(
    @Inject(PAYMENT_GATEWAY_PORT) private readonly gateway: PaymentGatewayPort,
    @Inject(PAYMENT_PUBLIC_CONFIG) private readonly publicConfig: PaymentPublicConfig,
    @Inject(FEES_CONFIG) private readonly fees: FeesConfig,
  ) {}

  /**
   * Railway: fresh acceptance token → view. Errors: PAYMENT_GATEWAY_UNAVAILABLE.
   * The acceptance token is single-use at the gateway, so it is fetched on every call.
   */
  execute(): Promise<Result<PaymentConfigView, DomainError>> {
    return fromResult(this.gateway.getAcceptance())
      .map((acceptance) => ({
        publicKey: this.publicConfig.publicKey,
        tokenizationUrl: this.publicConfig.tokenizationUrl,
        acceptance: { token: acceptance.token, permalink: acceptance.permalink },
        currency: this.publicConfig.currency,
        baseFeeInCents: this.fees.baseFeeInCents,
        deliveryFeeInCents: this.fees.deliveryFeeInCents,
      }))
      .toPromise();
  }
}
