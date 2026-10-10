import { Duration } from 'aws-cdk-lib';
import {
  HeadersFrameOption,
  HeadersReferrerPolicy,
  type ResponseSecurityHeadersBehavior,
} from 'aws-cdk-lib/aws-cloudfront';

export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=()';

/** CSP for the SPA: everything same-origin, plus XHR to the payment gateway for card tokenization. */
export function contentSecurityPolicy(gatewayOrigin: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // MUI (Emotion) injects style tags at runtime.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self' ${gatewayOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** Headers shared by SPA and API responses. The API sets its own CSP, so it is not overridden there. */
export function securityHeaders(options: {
  contentSecurityPolicy?: string;
}): ResponseSecurityHeadersBehavior {
  return {
    strictTransportSecurity: {
      accessControlMaxAge: Duration.days(730),
      includeSubdomains: true,
      preload: true,
      override: true,
    },
    contentTypeOptions: { override: true },
    frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
    referrerPolicy: {
      referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
      override: true,
    },
    ...(options.contentSecurityPolicy
      ? {
          contentSecurityPolicy: {
            contentSecurityPolicy: options.contentSecurityPolicy,
            override: true,
          },
        }
      : {}),
  };
}
