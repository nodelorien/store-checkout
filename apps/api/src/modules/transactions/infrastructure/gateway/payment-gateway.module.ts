import { Module } from '@nestjs/common';
import { PAYMENT_GATEWAY_PORT } from '../../application/ports/payment-gateway.port';
import { FetchFn, HTTP_FETCH, HttpPaymentGatewayAdapter } from './http-payment-gateway.adapter';

/** Owns the outbound gateway adapter; imported by every module that needs the port. */
@Module({
  providers: [
    // Wrapped so the global is resolved at call time and never invoked with a foreign `this`.
    { provide: HTTP_FETCH, useFactory: (): FetchFn => (input, init) => fetch(input, init) },
    { provide: PAYMENT_GATEWAY_PORT, useClass: HttpPaymentGatewayAdapter },
  ],
  exports: [PAYMENT_GATEWAY_PORT],
})
export class PaymentGatewayModule {}
