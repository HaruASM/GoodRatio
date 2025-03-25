/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // 로깅 최소화 설정
  poweredByHeader: false,
  
  // 개발 서버 로깅 설정 (Next.js 15.2 이상)
  logging: {
    // 들어오는 요청 로깅 설정
    incomingRequests: {
      // 정적 자원 및 API 로그 필터링
      ignore: [
        // 구글 Place Photo API 요청
        /\/api\/place-photo/,
        // 이미지 및 정적 파일
        /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot)$/,
        // Next.js 내부 정적 자원
        /\/_next\/static/,
        /\/_next\/image/
      ]
    },
  },
  
  // Webpack 설정
  webpack: (config, { dev }) => {
    if (dev) {
      // API 요청 로그 숨기기 위한 설정
      config.infrastructureLogging = {
        level: 'error', // 'info'에서 'error'로 변경
      };
      // 추가 로깅 레벨 설정
      config.stats = 'errors-only';
    }
    return config;
  },
  
  // Turbopack 설정 (객체 형태로 설정)
  experimental: {
    turbo: {
      // 빈 객체로도 유효한 설정
    },
  },
  
  // 개발 서버 설정
  onDemandEntries: {
    // 정적 페이지 캐싱 시간 (ms)
    maxInactiveAge: 60 * 60 * 1000, // 1시간
    // 캐시 크기
    pagesBufferLength: 5,
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