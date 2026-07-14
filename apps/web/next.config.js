/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile the workspace shared package (TS sources) at build time.
  transpilePackages: ['@overlay/shared'],
  // Emit a self-contained server (.next/standalone) for lean Docker images.
  output: 'standalone',
};

module.exports = nextConfig;
