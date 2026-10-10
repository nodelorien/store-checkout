// Bundles the compiled NestJS API (apps/api/dist/lambda.js) into a single file for Lambda.
// The API is compiled with tsc first because esbuild does not emit decorator metadata.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const infraRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.resolve(infraRoot, '..', 'apps', 'api');
const entry = path.join(apiRoot, 'dist', 'lambda.js');
const outDir = path.join(infraRoot, 'build', 'api');

if (!existsSync(entry)) {
  console.error(`Missing ${entry}. Run "npm run build -w apps/api" first.`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [entry],
  outfile: path.join(outDir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: false,
  sourcemap: false,
  keepNames: true,
  logLevel: 'info',
  external: [
    // Optional NestJS integrations that are lazily required and not used here.
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    '@fastify/static',
    '@fastify/view',
    'class-transformer/storage',
    // Served from disk at runtime (static assets), copied below.
    'swagger-ui-dist',
  ],
});

// Swagger UI static files are resolved through require() at runtime.
const require = createRequire(path.join(apiRoot, 'package.json'));
const swaggerUiDir = path.dirname(require.resolve('swagger-ui-dist/package.json'));
cpSync(swaggerUiDir, path.join(outDir, 'node_modules', 'swagger-ui-dist'), { recursive: true });

console.log(`Lambda bundle ready at ${outDir}`);
