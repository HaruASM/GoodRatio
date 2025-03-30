import { useEffect } from 'react';

/**
 * 정적 자원 요청에 대한 로깅을 필터링하는 컴포넌트
 * 클라이언트 사이드에서만 실행됩니다.
 */
function LoggingFilter() {
  useEffect(() => {
    // 개발 환경에서만 로깅 필터 활성화
    if (process.env.NODE_ENV === 'development') {
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
  }, []);

  // 이 컴포넌트는 UI를 렌더링하지 않습니다
  return null;
}

export default LoggingFilter; 