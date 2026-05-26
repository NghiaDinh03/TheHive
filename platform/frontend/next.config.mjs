/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // Forward API calls to backend in dev/prod via env-driven rewrite.
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_API_PROXY_TARGET || 'http://backend:8080';
    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
      { source: '/healthz', destination: `${target}/healthz` },
      { source: '/readyz', destination: `${target}/readyz` },
    ];
  },
  // Avoid leaking framework version
  generateBuildId: async () => process.env.GIT_SHA || 'dev',
  // Đảm bảo Hot Reload hoạt động mượt mà trong Docker trên Windows
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;
