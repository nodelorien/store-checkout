import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Hexagonal boundary: inner layers must not know frameworks, SDKs or outer layers (ADR-0002). */
const innerLayerForbiddenImports = [
  { group: ['@aws-sdk/*'], message: 'AWS SDK belongs in infrastructure adapters.' },
  { group: ['express', 'supertest', 'helmet'], message: 'HTTP belongs in infrastructure.' },
  {
    group: ['@nestjs/swagger', '@nestjs/platform-express', '@nestjs/core'],
    message: 'Framework wiring belongs in infrastructure.',
  },
  { group: ['**/infrastructure/**'], message: 'Inner layers cannot depend on infrastructure.' },
];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/cdk.out/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['apps/api/**/*.ts', 'infra/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  {
    files: ['apps/api/src/**/domain/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...innerLayerForbiddenImports,
            { group: ['@nestjs/*'], message: 'The domain is pure TypeScript.' },
            {
              group: ['**/application/**'],
              message: 'The domain cannot depend on the application layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/**/application/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: innerLayerForbiddenImports }] },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.jest } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  prettier,
);
