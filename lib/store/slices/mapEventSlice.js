import { createSlice } from '@reduxjs/toolkit';
import MapOverlayManager from '../../components/map/MapOverlayManager';

/**
 * 맵 이벤트 관리를 위한 리덕스 슬라이스
 * 특히 인포윈도우의 상태와 맵 줌 레벨 관리에 초점
 */

const initialState = {
  // 선택된 아이템 정보 (인포윈도우와 연동)
  selectedItemId: null,
  selectedSectionName: null,
  
  // 맵 줌 상태
  zoomLevel: 14,
  isPolygonVisible: false, // 폴리곤 가시성 (줌 레벨에 따라 결정됨)
  
  // 지도 이벤트 상태 추적
  lastEvent: null,     // 가장 최근에 발생한 이벤트 타입
  
  // 현재 활성화된 섹션
  currentSection: null
};

// 같은 ID의 인포윈도우가 반복 호출되는 것을 방지하기 위한 변수
let lastInfoWindowId = null;
let lastInfoWindowSectionName = null;
let infoWindowDebounceTimer = null;

const mapEventSlice = createSlice({
  name: 'mapEvent',
  initialState,
  reducers: {
    // 싱글톤 인포윈도우 열기
    openSingletonInfoWindow: (state, action) => {
      console.log('[MapEventSlice] openSingletonInfoWindow 액션 호출');
      
      // 액션 페이로드에서 필요한 정보만 추출
      const { shopId: Id, sectionName } = action.payload;
      
      // 필수 필드 유효성 검사
      if (!Id || !sectionName) {
        console.error('[MapEventSlice] openSingletonInfoWindow 액션에 필수 필드(shopId 또는 sectionName)가 누락되었습니다.');
        return; // 필수 필드가 없으면 아무 작업도 하지 않음
      }
      
      // 반복 호출 체크 (같은 인포윈도우 반복 호출 방지)
      if (Id === lastInfoWindowId && sectionName === lastInfoWindowSectionName) {
        console.log(`[MapEventSlice] 같은 인포윈도우 ${sectionName}/${Id} 반복 호출 무시`);
        
        // 기존 타이머 취소
        if (infoWindowDebounceTimer) {
          clearTimeout(infoWindowDebounceTimer);
        }
        
        // 새 타이머 설정
        infoWindowDebounceTimer = setTimeout(() => {
          lastInfoWindowId = null;
          lastInfoWindowSectionName = null;
        }, 1000); // 1초 동안 같은 인포윈도우 호출 무시
        
        return;
      }
      
      // 호출 기록 업데이트
      lastInfoWindowId = Id;
      lastInfoWindowSectionName = sectionName;
      
      // 디바운스 타이머 취소
      if (infoWindowDebounceTimer) {
        clearTimeout(infoWindowDebounceTimer);
      }
      
      // 새 타이머 설정
      infoWindowDebounceTimer = setTimeout(() => {
        lastInfoWindowId = null;
        lastInfoWindowSectionName = null;
      }, 1000); // 1초 후 기록 초기화
      
      try {
        // MapOverlayManager.openSingletonInfoWindow 직접 호출
        // shopId는 ID로 사용 (요구사항에 따라)
        MapOverlayManager.openSingletonInfoWindow(sectionName, Id);
        
        // 상태 업데이트 (필요시)
        state.selectedItemId = Id;
        state.selectedSectionName = sectionName;
        state.lastEvent = 'OPEN_INFO_WINDOW';
      } catch (error) {
        console.error('[MapEventSlice] 인포윈도우 표시 중 오류:', error);
      }
    },
    
    // 싱글톤 인포윈도우 닫기
    closeInfoWindow: (state) => {
      state.lastEvent = 'CLOSE_INFO_WINDOW';
      
      // 인포윈도우 닫기 액션 처리
      try {
        MapOverlayManager.closeSingletonInfoWindow();
      } catch (error) {
        console.error('[MapEventSlice] 인포윈도우 닫기 중 오류:', error);
      }
      
      // 선택 상태 초기화
      state.selectedItemId = null;
      state.selectedSectionName = null;
      
      // 호출 기록 초기화
      lastInfoWindowId = null;
      lastInfoWindowSectionName = null;
      
      // 타이머 취소
      if (infoWindowDebounceTimer) {
        clearTimeout(infoWindowDebounceTimer);
        infoWindowDebounceTimer = null;
      }
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
        // MapOverlayManager의 changeOverlaysOfCursection 메서드 호출
        MapOverlayManager.changeOverlaysOfCursection(sectionName);
      } catch (error) {
        console.error('[MapEventSlice] 섹션 오버레이 변경 중 오류:', error);
      }
    }
  }
});

// 액션 생성자 내보내기
export const {
  openSingletonInfoWindow,
  closeInfoWindow,
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

// 리듀서 내보내기
export default mapEventSlice.reducer; 