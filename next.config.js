/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // 로깅 최소화 설정
  poweredByHeader: false,
  
  // ESLint 설정 - 오류 무시
  eslint: {
    // 빌드 시 오류가 있어도 진행하도록 설정
    ignoreDuringBuilds: true,
  },
  
  // 타입 체크 오류 무시
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 리액트 엄격 모드 비활성화
  reactStrictMode: false,
  
  // 잘못된 페이지 무시 - Next.js 14 및 15에서 추가된 옵션
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  
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
      // API 요청 로그 줄이기 위한 설정
      config.infrastructureLogging = {
        level: 'error', // 'info'에서 'error'로 변경
      };
      // 추가 로깅 안보 설정
      config.stats = 'errors-only';
    }
    return config;
  },
  
  // 유틸리티 파일 설정 (페이지가 아닌 파일 무시)
  excludeDefaultMomentLocales: true,
  
  // 제외할 디렉토리 경로 설정
  transpilePackages: [],
  
  // Turbopack 설정 (객체 형태로 설정)
  experimental: {
    turbo: {
      // 빈 객체로도 유효한 설정
      resolveAlias: {
        // HMR 문제 해결을 위한 설정
      },
    },
    // Next.js 15로 전환시 호환성을 위한 추가 설정
    webVitalsAttribution: ['CLS', 'LCP'],
    optimizePackageImports: ['react', 'react-dom'],
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
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
    ],
    // 이미지 예외처리 경로 설정
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

module.exports = nextConfig; 