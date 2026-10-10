import { Module } from '@nestjs/common';
import { GATEWAY_EVENT_VERIFIER } from '../../application/ports/gateway-event-verifier.port';
import { PAYMENT_GATEWAY_PORT } from '../../application/ports/payment-gateway.port';
import { ChecksumGatewayEventVerifier } from './checksum-gateway-event.verifier';
import { FetchFn, HTTP_FETCH, HttpPaymentGatewayAdapter } from './http-payment-gateway.adapter';

/** Owns the outbound gateway adapter; imported by every module that needs the port. */
@Module({
  providers: [
    // Wrapped so the global is resolved at call time and never invoked with a foreign `this`.
    { provide: HTTP_FETCH, useFactory: (): FetchFn => (input, init) => fetch(input, init) },
    { provide: PAYMENT_GATEWAY_PORT, useClass: HttpPaymentGatewayAdapter },
    { provide: GATEWAY_EVENT_VERIFIER, useClass: ChecksumGatewayEventVerifier },
  ],
  exports: [PAYMENT_GATEWAY_PORT, GATEWAY_EVENT_VERIFIER],
})
export class PaymentGatewayModule {}
