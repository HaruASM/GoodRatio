import { Provider } from 'react-redux';
import store from '../pages/editor/store';
import '../styles/globals.css'; // 전역 스타일시트 임포트
import { useEffect } from 'react';
import App from 'next/app';

/**
 * 정적 자원 요청에 대한 로깅을 필터링하는 글로벌 설정
 */
function setupLoggingFilter() {
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    // 원본 fetch 메서드 보존
    const originalFetch = window.fetch;
    
    // fetch 오버라이드
    window.fetch = async function(url, options = {}) {
      // 정적 자원 요청 체크
      const isStaticRequest = 
        typeof url === 'string' && (
          url.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot)$/i) ||
          url.includes('/api/place-photo') ||
          url.includes('/_next/image') ||
          url.includes('/_next/static')
        );
      
      // 정적 자원 요청인 경우 로깅 스킵 헤더 추가
      if (isStaticRequest) {
        options.headers = options.headers || {};
        options.headers['x-skip-logging'] = 'true';
      }
      
      // 원본 fetch 호출
      return originalFetch.call(this, url, options);
    };
    
    console.log('[로깅 필터] 정적 자원 요청 로깅 필터 설정 완료');
  }
}

/**
 * Next.js 커스텀 App 컴포넌트
 */
function MyApp({ Component, pageProps }) {
  // 컴포넌트 마운트 시 로깅 필터 설정
  useEffect(() => {
    setupLoggingFilter();
  }, []);
  
  return (
    <Provider store={store}>
      <Component {...pageProps} />
    </Provider>
  );
}

export default MyApp; 