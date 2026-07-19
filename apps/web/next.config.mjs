/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS; Next transpiles them.
  transpilePackages: ['@kargotrack/shared', '@kargotrack/db'],
  experimental: {
    // Enables instrumentation.ts register() hook on server startup (Next 14).
    instrumentationHook: true,
  },
};

export default nextConfig;
