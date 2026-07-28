import path from 'node:path';
import { fileURLToPath } from 'node:url';

import createNextIntlPlugin from 'next-intl/plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Panel i18n (AUDIT.md T17): locale comes from a cookie, not the URL, so there
// is no `[locale]` segment and no i18n middleware — just the request config.
// (`middleware.ts` exists, but only to bounce signed-in admins off the landing.)
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for Docker (.next/standalone). See apps/web/Dockerfile.
  output: 'standalone',
  // Workspace packages ship raw TS; Next transpiles them.
  transpilePackages: ['@kargotrack/shared', '@kargotrack/db'],
  experimental: {
    // Trace files from the monorepo root so standalone bundles workspace deps.
    outputFileTracingRoot: path.join(__dirname, '../..'),
    // Enables instrumentation.ts register() hook on server startup (Next 14).
    instrumentationHook: true,
    // Keep these as runtime requires, not webpack-bundled: argon2 is a native
    // addon; pg-boss + xlsx pull in Node built-ins/optional deps that break
    // bundling.
    serverComponentsExternalPackages: ['@node-rs/argon2', 'pg-boss', 'xlsx'],
  },
};

export default withNextIntl(nextConfig);
