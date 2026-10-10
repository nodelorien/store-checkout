export const ID_GENERATOR = Symbol('ID_GENERATOR');

export interface IdGenerator {
  /** RFC 4122 v4 UUID. */
  uuid(): string;
  /** `length` random characters from the uppercase base32 alphabet (A-Z, 2-7). */
  randomBase32(length: number): string;
}
