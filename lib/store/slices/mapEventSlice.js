import { createSlice } from '@reduxjs/toolkit';
import MapOverlayManager from '../../components/map/MapOverlayManager';

/**
 * 맵 이벤트 관리를 위한 리덕스 슬라이스
 * 특히 맵 줌 레벨 관리에 초점
 */

const initialState = {
  // 선택된 아이템 정보
  selectedItemId: null,
  selectedSectionName: null,
  
  // 맵 줌 상태
  zoomLevel: 14,
  isPolygonVisible: false, // 폴리곤 가시성 (줌 레벨에 따라 결정됨)
  
  // 지도 이벤트 상태 추적
  lastEvent: null,     // 가장 최근에 발생한 이벤트 타입
  
  // 현재 활성화된 섹션
  currentSection: null,
  
  // 선택된 상점 아이템 (shopItemSelected 액션에서 사용)
  selectedShopItem: null
};

const mapEventSlice = createSlice({
  name: 'mapEvent',
  initialState,
  reducers: {
    // 상점 아이템 선택 액션
    shopItemSelected: (state, action) => {
      const { id, sectionName } = action.payload;
      
      if (!id || !sectionName) {
        console.error('[MapEventSlice] shopItemSelected 액션에 필수 필드(id 또는 sectionName)가 누락되었습니다.');
        return;
      }
      
      state.selectedItemId = id;
      state.selectedSectionName = sectionName;
      state.lastEvent = 'SHOP_ITEM_SELECTED';
    },
    
    // 줌 레벨 업데이트 (맵 줌 이벤트에서 호출)
    updateZoomLevel: (state, action) => {
      const { zoomLevel } = action.payload;
      state.zoomLevel = zoomLevel;
      
      // 줌 레벨에 따라 폴리곤 가시성 설정 (15 이상에서 표시)
      state.isPolygonVisible = zoomLevel >= 15;
      state.lastEvent = 'ZOOM_CHANGED';
    },
    
    // 현재 섹션 변경 액션
    curSectionChanged: (state, action) => {
      const { sectionName } = action.payload;
      
      if (!sectionName) {
        console.error('[MapEventSlice] curSectionChanged 액션에 필수 필드(sectionName)가 누락되었습니다.');
        return;
      }
      
      // 상태 업데이트
      state.currentSection = sectionName;
      state.lastEvent = 'SECTION_CHANGED';
      
      try {
        // MapOverlayManager의 changeSection 메서드 직접 호출
        MapOverlayManager.changeSection(sectionName);
      } catch (error) {
        console.error('[MapEventSlice] 섹션 오버레이 변경 중 오류:', error);
      }
    }
  }
});

// 액션 생성자 내보내기
export const {
  shopItemSelected,
  updateZoomLevel,
  curSectionChanged
} = mapEventSlice.actions;

// 선택자(selector) 함수 내보내기
export const selectZoomLevel = (state) => state.mapEvent.zoomLevel;
export const selectIsPolygonVisible = (state) => state.mapEvent.isPolygonVisible;
export const selectLastMapEvent = (state) => state.mapEvent.lastEvent;
export const selectCurrentSection = (state) => state.mapEvent.currentSection;

// 현재 선택된 아이템의 ID 가져오기 (없으면 null)
export const selectSelectedItemId = (state) => state.mapEvent.selectedItemId;
export const selectSelectedSectionName = (state) => state.mapEvent.selectedSectionName;

// 리듀서 내보내기
export default mapEventSlice.reducer; 