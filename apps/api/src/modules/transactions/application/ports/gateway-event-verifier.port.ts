export const GATEWAY_EVENT_VERIFIER = Symbol('GATEWAY_EVENT_VERIFIER');

/** A gateway event after shape validation (see `parseGatewayEvent`). */
export interface GatewayEvent {
  readonly event: string;
  readonly data: Record<string, unknown>;
  readonly signature: { readonly properties: readonly string[]; readonly checksum: string };
  readonly timestamp: number;
}

export interface GatewayEventVerifier {
  /** `true` only when the event checksum matches the one computed with the events secret. */
  verify(event: GatewayEvent): boolean;
}
