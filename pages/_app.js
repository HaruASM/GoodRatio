import { Provider } from 'react-redux';
import { wrapper } from '../lib/store';
import '../styles/globals.css'; // 전역 스타일시트 임포트
import dynamic from 'next/dynamic';
import ImageGallery from '../components/editor/ImageGallery';
import { ImageSelectionGallery, ImageOrderEditorGallery } from '../components/editor/ImageGalleryforEditor';

// 로깅 필터 컴포넌트를 클라이언트 사이드에서만 로드
const LoggingFilter = dynamic(() => import('../components/LoggingFilter'), { 
  ssr: false 
});

/**
 * Next.js 커스텀 App 컴포넌트
 */
function MyApp({ Component, pageProps }) {
  // next-redux-wrapper의 최신 API 사용
  const { store, props } = wrapper.useWrappedStore(pageProps);
  
  return (
    <Provider store={store}>
      <LoggingFilter />
      <Component {...props.pageProps} />
      <ImageGallery />
      <ImageSelectionGallery />
      <ImageOrderEditorGallery />
    </Provider>
  );
}

export default MyApp; 