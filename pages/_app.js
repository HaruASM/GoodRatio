
import { Provider } from 'react-redux';
import { wrapper } from '../lib/store';
import '../styles/globals.css'; // 전역 스타일시트 임포트
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
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
 * 경로 기반으로 필요한 모듈 배열을 반환하는 함수
 * @param {string} path - 현재 경로
 * @returns {Array} 필요한 모듈 이름 배열
 */
const getRequiredModulesForPath = (path) => {
  if (!path) return [];
  
  // 모든 경로 패턴을 확인하여 매치되는 모듈 찾기
  const requiredModules = [];
  
  Object.entries(ROUTE_MODULE_MAP).forEach(([pattern, modules]) => {
    if (new RegExp(pattern).test(path)) {
      requiredModules.push(...modules);
    }
  });
  
  // 중복 제거하여 고유한 모듈 이름만 반환
  return [...new Set(requiredModules)];
};

/**
 * 전역 모듈 초기화 함수
 * 애플리케이션 실행 시 한 번만 호출됨
 */
const initializeGlobalModules = () => {
  // 브라우저 환경일 때만 실행
  if (typeof window === 'undefined') return;
  
  console.log('[ModuleManager] 전역 모듈 초기화 시작');
  
  // MapOverlayManager 모듈 등록 (지연 초기화)
  // 모듈 자체는 자신의 주요 기능에만 집중하고 모듈 관리는 ModuleManager에서 처리
  ModuleManager.register('mapOverlayManager', () => {
    console.log('[ModuleManager] MapOverlayManager 모듈 지연 초기화 실행');
    
    // 동적으로 MapOverlayManager 가져오기
    const MapOverlayManager = require('../lib/components/map/MapOverlayManager').default;
    console.log('[ModuleManager] MapOverlayManager 모듈 로드 완료');
    
    // 모듈 인스턴스 반환
    return MapOverlayManager;
  });
  
  // 필요하다면 더 많은 전역 모듈을 여기에 등록
  // 예: editorStateManager 모듈
  /*
  ModuleManager.register('editorStateManager', () => {
    console.log('[ModuleManager] EditorStateManager 모듈 지연 초기화 실행');
    
    // 동적으로 EditorStateManager 가져오기
    const EditorStateManager = require('../lib/editor/EditorStateManager').default;
    
    // 모듈 인스턴스 반환
    return EditorStateManager;
  });
  */
  
  console.log('[ModuleManager] 전역 모듈 초기화 완료');
};

/**
 * ModuleInitializer 컴포넌트
 * 컴포넌트가 마운트될 때 모듈 초기화 수행
 */
const ModuleInitializer = () => {
  useEffect(() => {
    // 모듈 초기화 (최초 한 번만 수행)
    initializeGlobalModules();
    
    // 클린업 함수
    return () => {
      // 애플리케이션 종료 시 모든 모듈 정리 (필요한 경우)
      // ModuleManager.cleanupAll();
    };
  }, []);
  
  return null; // 이 컴포넌트는 UI를 렌더링하지 않음
};

/**
 * 페이지 전환에 따른 모듈 관리를 담당하는 컴포넌트
 * ModuleManager가 모듈 생명주기를 관리하고 컴포넌트는 단순히 경로 변경 감지에만 집중
 */
const ModuleRouteManager = () => {
  const router = useRouter();
  const prevPathRef = useRef(router.pathname);
  const prevRequiredModulesRef = useRef([]);
  
  useEffect(() => {
    // 현재 경로에 필요한 모듈 목록 가져오기
    const currentPath = router.pathname;
    const currentRequiredModules = getRequiredModulesForPath(currentPath);
    
    console.log(`[ModuleRouteManager] 경로 변경: ${prevPathRef.current} -> ${currentPath}`);
    console.log(`[ModuleRouteManager] 현재 경로 필요 모듈: ${currentRequiredModules.join(', ') || '없음'}`);
    
    // 이전 경로에서 사용했지만 현재 경로에서는 필요 없는 모듈 suspend
    // ROUTE_MODULE_MAP에 정의된 페이지별 모듈 설정에 따라 현재 페이지에서 불필요한 모듈 일시 중단
    const modulesToSuspend = prevRequiredModulesRef.current.filter(
      module => !currentRequiredModules.includes(module)
    );
    
    // 사용하지 않는 모듈 일시 중단 (ModuleManager가 담당)
    modulesToSuspend.forEach(moduleName => {
      if (ModuleManager.isInitialized(moduleName)) {
        console.log(`[ModuleRouteManager] 모듈 일시 중단 요청: ${moduleName}`);
        ModuleManager.suspend(moduleName);
      }
    });
    
    // 이전 경로와 모듈 목록 업데이트
    prevPathRef.current = currentPath;
    prevRequiredModulesRef.current = currentRequiredModules;
    
    // 브라우저 종료 이벤트 리스너 등록 (cleanup 호출)
    const handleBeforeUnload = () => {
      console.log('[ModuleRouteManager] 앱 종료 감지, 모든 모듈 정리');
      ModuleManager.cleanupAll();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // 페이지 이탈 시 정리
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [router.pathname]);
  
  return null; // 이 컴포넌트는 UI를 렌더링하지 않음
};

/**
 * Next.js 커스텀 App 컴포넌트
 */
function MyApp({ Component, pageProps }) {
  
  
  
  // next-redux-wrapper의 최신 API 사용
  const { store, props } = wrapper.useWrappedStore(pageProps);
  
  return (
    <Provider store={store}>
      {/* 모듈 초기화와 라우팅 관리는 클라이언트 사이드에서만 렌더링 */}
          <ModuleInitializer />
          <ModuleRouteManager />

      <LoggingFilter />
      <Component {...props.pageProps} />
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