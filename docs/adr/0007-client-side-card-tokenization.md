# ADR-0007: Tokenize cards in the browser

- Status: Accepted
- Date: 2026-10-09
- Drivers: NFR-05 (OWASP bonus), FR-03, FR-11

## Context

"Safely handling sensitive data" is an explicit responsibility. The payment gateway offers a
card tokenization endpoint authenticated with the **public** key, designed to be called from the
client, and a charge endpoint authenticated with the **private** key.

## Decision

- The browser sends card data straight to the gateway's tokenization endpoint over HTTPS and
  receives a short-lived token plus brand and last four digits.
- Our API receives only `cardToken` (+ the acceptance token the user agreed to). It never
  receives, validates, stores or logs PAN, CVC or expiry.
- The private key and integrity secret exist only in the API environment (SSM in AWS, `.env` locally).
- The public key and acceptance-terms link reach the SPA through `GET /api/v1/payment-config`, so
  the SPA build contains no gateway configuration.
- Client-side validation (Luhn, brand, expiry, CVC length) is UX only; the gateway is the authority.
- API request logging redacts `cardToken`, emails and phone numbers.

## Consequences

- Positive: card data never touches our infrastructure — smallest possible compliance surface.
- Positive: the persisted token lets the flow survive a refresh at the summary step without retyping the card.
- Negative: the CSP must allow `connect-src` to the gateway host.
- Negative: tokens expire; the UI must detect expiry and send the user back to the card step.

## Alternatives rejected

- Send card data to our API and tokenize server-side — puts PAN in our request path and logs.
- Gateway hosted widget/redirect — would bypass the custom modal and backdrop the brief asks us to build.
