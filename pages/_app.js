import { Provider } from 'react-redux';
import { wrapper } from '../lib/store';
import '../styles/globals.css'; // 전역 스타일시트 임포트
import dynamic from 'next/dynamic';
import ModuleManager from '../lib/moduleManager';

// 로깅 필터 컴포넌트를 클라이언트 사이드에서만 로드
const LoggingFilter = dynamic(() => import('../components/LoggingFilter'), { 
  ssr: false 
});

// 이미지 갤러리 컴포넌트들을 클라이언트 사이드에서만 로드
const ImageGallery = dynamic(() => import('../components/editor/ImageGallery'), {
  ssr: false
});

const ImageSelectionGallery = dynamic(() => import('../components/editor/ImageGalleryforEditor').then(mod => mod.ImageSelectionGallery), {
  ssr: false
});

const ImageOrderEditorGallery = dynamic(() => import('../components/editor/ImageGalleryforEditor').then(mod => mod.ImageOrderEditorGallery), {
  ssr: false
});

/**
 * 라우트 경로별 필요한 모듈 맵핑
 * 각 경로 패턴과 해당 경로에서 필요한 모듈들을 정의합니다.
 */
const ROUTE_MODULE_MAP = {
  // 메인 페이지
  '^/$': [],
  
  // 클라이언트용 맵탐색 화면
  '^/browser': ['mapOverlayManager'],
  
  '^/editor': ['mapOverlayManager'],
  
};

/**
 * ModuleManagerClient - 클라이언트 사이드에서만 실행되는 모듈 관리자 초기화 컴포넌트
 * useEffect 사용 없이 클라이언트 사이드에서만 필요한 기능 수행
 */
const ModuleManagerClient = dynamic(() => 
  Promise.resolve(({ router }) => {
    // 컴포넌트가 마운트될 때 모듈 매니저 초기화
    if (typeof window !== 'undefined' && !window.__moduleManagerInitialized) {
      window.__moduleManagerInitialized = true;
      
      // ModuleManager 초기화
      ModuleManager.initialize();
      
      // 현재 경로 처리
      ModuleManager.handleRouteChange(router.pathname, ROUTE_MODULE_MAP);
      
      // 라우터 이벤트 리스너 등록
      router.events.on('routeChangeComplete', (path) => {
        ModuleManager.handleRouteChange(path, ROUTE_MODULE_MAP);
      });
    }
    
    return null; // UI를 렌더링하지 않음
  }),
  { ssr: false } // 서버 사이드 렌더링 비활성화
);

/**
 * Next.js 커스텀 App 컴포넌트
 */
function MyApp({ Component, pageProps }) {
  // next-redux-wrapper의 최신 API 사용
  const { store, props } = wrapper.useWrappedStore(pageProps);
  
  // props가 undefined이거나 router가 없는 경우 기본값 제공
  const defaultRouter = { pathname: '/', events: { on: () => {} } };
  
  return (
    <Provider store={store}>
      <ModuleManagerClient router={props?.__N_SSG ? defaultRouter : (props?.router || defaultRouter)} />
      <LoggingFilter />
      <Component {...(props?.pageProps || pageProps)} />
      <ImageGallery />
      <ImageSelectionGallery />
      <ImageOrderEditorGallery />
    </Provider>
  );
}

// 전역 객체로 모듈 매니저 노출 (개발 및 디버깅용)
if (typeof window !== 'undefined') {
  window.ModuleManager = ModuleManager;
}

export default MyApp; 