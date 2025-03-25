import { Provider } from 'react-redux';
import store from '../pages/editor/store';
import '../styles/globals.css'; // 전역 스타일시트 임포트

function MyApp({ Component, pageProps }) {
  return (
    <Provider store={store}>
      <Component {...pageProps} />
    </Provider>
  );
}

export default MyApp; 