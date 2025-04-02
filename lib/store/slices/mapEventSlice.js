import { createSlice } from '@reduxjs/toolkit';

/**
 * 맵 이벤트 관리를 위한 리덕스 슬라이스
 * 특히 인포윈도우의 상태와 선택된 아이템 관리에 초점
 */

const initialState = {
  // 인포윈도우 상태
  isInfoWindowOpen: false,
  
  // 인포윈도우에 표시할 컨텐츠 정보
  infoWindowContent: {
    content: '',       // HTML 형식의 콘텐츠
    position: null,    // 좌표 (lat, lng)
    markerId: null,    // 연결된 마커 ID (있는 경우)
    shopId: null,      // 연결된 상점 ID (있는 경우)
    sectionName: null  // 섹션 이름 (있는 경우)
  },
  
  // 맵 상호작용 관련 상태
  selectedItem: {
    id: null,          // 선택된 아이템 ID
    sectionName: null, // 섹션 이름
    isHighlighted: false // 강조 표시 여부
  },
  
  // 맵 줌 상태
  zoomLevel: 14,
  isPolygonVisible: false, // 폴리곤 가시성 (줌 레벨에 따라 결정됨)
  
  // 지도 이벤트 상태 추적
  lastEvent: null,     // 가장 최근에 발생한 이벤트 타입
  isMapReady: false    // 맵 초기화 완료 여부
};

const mapEventSlice = createSlice({
  name: 'mapEvent',
  initialState,
  reducers: {
    // 인포윈도우 열기
    openInfoWindow: (state, action) => {
      const { content, position, markerId, shopId, sectionName } = action.payload;
      
      state.isInfoWindowOpen = true;
      state.infoWindowContent = {
        content: content || '',
        position: position || null,
        markerId: markerId || null,
        shopId: shopId || null,
        sectionName: sectionName || null
      };
      
      // 선택된 아이템 정보도 함께 업데이트
      if (shopId) {
        state.selectedItem = {
          id: shopId,
          sectionName: sectionName || null,
          isHighlighted: true
        };
      }
      
      state.lastEvent = 'OPEN_INFO_WINDOW';
    },
    
    // 인포윈도우 닫기
    closeInfoWindow: (state) => {
      state.isInfoWindowOpen = false;
      
      // 선택 상태 유지하면서 인포윈도우만 닫기
      // 선택된 아이템의 하이라이트 상태만 해제
      if (state.selectedItem.id) {
        state.selectedItem.isHighlighted = false;
      }
      
      state.lastEvent = 'CLOSE_INFO_WINDOW';
    },
    
    // 아이템 선택
    selectItem: (state, action) => {
      const { id, sectionName, showInfoWindow = true } = action.payload;
      
      // 현재 선택된 아이템과 같은 경우 토글 동작
      if (state.selectedItem.id === id && state.selectedItem.sectionName === sectionName) {
        // 이미 선택된 아이템을 다시 선택하면 선택 해제
        state.selectedItem = {
          id: null,
          sectionName: null,
          isHighlighted: false
        };
        
        // 인포윈도우도 닫기
        state.isInfoWindowOpen = false;
      } else {
        // 새 아이템 선택
        state.selectedItem = {
          id,
          sectionName,
          isHighlighted: true
        };
        
        // showInfoWindow 옵션이 true인 경우 인포윈도우 상태 활성화
        // 실제 인포윈도우 컨텐츠는 openInfoWindow 액션에서 설정
        state.isInfoWindowOpen = showInfoWindow;
      }
      
      state.lastEvent = 'SELECT_ITEM';
    },
    
    // 아이템 선택 해제
    deselectItem: (state) => {
      state.selectedItem = {
        id: null,
        sectionName: null,
        isHighlighted: false
      };
      
      // 인포윈도우도 닫기
      state.isInfoWindowOpen = false;
      state.lastEvent = 'DESELECT_ITEM';
    },
    
    // 줌 레벨 업데이트 (맵 줌 이벤트에서 호출)
    updateZoomLevel: (state, action) => {
      const { zoomLevel } = action.payload;
      state.zoomLevel = zoomLevel;
      
      // 줌 레벨에 따라 폴리곤 가시성 설정 (15 이상에서 표시)
      state.isPolygonVisible = zoomLevel >= 15;
      state.lastEvent = 'ZOOM_CHANGED';
    },
    
    // 맵 초기화 완료 표시
    setMapReady: (state, action) => {
      state.isMapReady = action.payload;
      if (action.payload) {
        state.lastEvent = 'MAP_READY';
      }
    }
  }
});

// 액션 생성자 내보내기
export const {
  openInfoWindow,
  closeInfoWindow,
  selectItem,
  deselectItem,
  updateZoomLevel,
  setMapReady
} = mapEventSlice.actions;

// 선택자(selector) 함수 내보내기
export const selectInfoWindowState = (state) => ({
  isOpen: state.mapEvent.isInfoWindowOpen,
  content: state.mapEvent.infoWindowContent
});

export const selectSelectedItem = (state) => state.mapEvent.selectedItem;
export const selectZoomLevel = (state) => state.mapEvent.zoomLevel;
export const selectIsPolygonVisible = (state) => state.mapEvent.isPolygonVisible;
export const selectIsMapReady = (state) => state.mapEvent.isMapReady;
export const selectLastMapEvent = (state) => state.mapEvent.lastEvent;

// 현재 선택된 아이템의 ID 가져오기 (없으면 null)
export const selectSelectedItemId = (state) => state.mapEvent.selectedItem.id;

// 리듀서 내보내기
export default mapEventSlice.reducer; 