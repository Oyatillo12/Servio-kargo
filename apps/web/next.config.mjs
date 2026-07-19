/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS; Next transpiles them.
  transpilePackages: ['@kargotrack/shared', '@kargotrack/db'],
  experimental: {
    // Enables instrumentation.ts register() hook on server startup (Next 14).
    instrumentationHook: true,
    // Keep these as runtime requires, not webpack-bundled: argon2 is a native
    // addon; pg-boss + xlsx pull in Node built-ins/optional deps that break
    // bundling.
    serverComponentsExternalPackages: ['@node-rs/argon2', 'pg-boss', 'xlsx'],
  },
};

export default nextConfig;
