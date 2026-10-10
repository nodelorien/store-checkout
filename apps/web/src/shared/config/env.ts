/** The only module allowed to read `import.meta.env` (Jest maps it to `src/test/envMock.ts`). */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
} as const;

export type Env = typeof env;
