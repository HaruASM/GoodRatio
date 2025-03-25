/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // 로깅 최소화 설정
  poweredByHeader: false,
  
  // Webpack 설정
  webpack: (config, { dev }) => {
    if (dev) {
      // API 요청 로그 숨기기 위한 설정
      config.infrastructureLogging = {
        level: 'error', // 'info'에서 'error'로 변경
      };
    }
    return config;
  },
  
  // Turbopack 설정 (객체 형태로 설정)
  experimental: {
    turbo: {
      // 빈 객체로도 유효한 설정
    },
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig; 