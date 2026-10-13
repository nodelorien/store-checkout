export const CATALOGUE_INVALIDATOR = Symbol('CATALOGUE_INVALIDATOR');

/** Lets whoever changes stock tell the catalogue that what it remembers is out of date. */
export interface CatalogueInvalidator {
  /** Never rejects: a catalogue that cannot be invalidated expires on its own. */
  invalidate(): Promise<void>;
}
