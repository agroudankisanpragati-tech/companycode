/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['react-quill'],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'agroudankisanpragati.com' },
      { protocol: 'https', hostname: 'api.agroudankisanpragati.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async rewrites() {
    const backendUrl = process.env.NODE_ENV === 'production'
      ? (process.env.BACKEND_URL || 'https://api.agroudankisanpragati.com')
      : 'http://localhost:4000';

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
