import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectInfoWindowState, closeInfoWindow } from '../store/slices/mapEventSlice';

/**
 * 구글 맵 인포윈도우 컴포넌트
 * Redux 상태에 따라 인포윈도우를 관리합니다.
 * 
 * 사용법: <MapInfoWindow map={googleMapInstance} />
 */
const MapInfoWindow = ({ map }) => {
  const infoWindowRef = useRef(null);
  const dispatch = useDispatch();
  const infoWindowState = useSelector(selectInfoWindowState);
  
  // 컴포넌트 마운트 시 인포윈도우 생성
  useEffect(() => {
    if (!window.google || !window.google.maps) {
      console.error('[MapInfoWindow] Google Maps API가 로드되지 않았습니다.');
      return;
    }
    
    // InfoWindow 인스턴스 생성
    infoWindowRef.current = new window.google.maps.InfoWindow({
      maxWidth: 300
    });
    
    // 닫기 이벤트 리스너
    infoWindowRef.current.addListener('closeclick', () => {
      dispatch(closeInfoWindow());
    });
    
    // 컴포넌트 언마운트 시 인포윈도우 정리
    return () => {
      if (infoWindowRef.current) {
        window.google.maps.event.clearInstanceListeners(infoWindowRef.current);
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }
    };
  }, [dispatch]);
  
  // 인포윈도우 상태 변경 시 처리
  useEffect(() => {
    if (!infoWindowRef.current || !map) return;
    
    const { isOpen, content } = infoWindowState;
    
    if (isOpen && content.content) {
      // 콘텐츠 설정
      infoWindowRef.current.setContent(content.content);
      
      // 위치가 있으면 해당 위치에 표시
      if (content.position) {
        const position = new window.google.maps.LatLng(
          content.position.lat,
          content.position.lng
        );
        infoWindowRef.current.setPosition(position);
        infoWindowRef.current.open(map);
      } else {
        // 마커가 없는 경우 맵 중앙에 표시
        infoWindowRef.current.open(map);
      }
    } else {
      // 닫기
      infoWindowRef.current.close();
    }
  }, [infoWindowState, map]);
  
  // InfoWindow는 DOM에 직접 렌더링되므로 컴포넌트는 null을 반환
  return null;
};

export default MapInfoWindow; 