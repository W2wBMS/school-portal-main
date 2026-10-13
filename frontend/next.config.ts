import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'https://rucst-student-portal-api.onrender.com';

    const destinationUrl = backendUrl.replace(/\/+$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${destinationUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
