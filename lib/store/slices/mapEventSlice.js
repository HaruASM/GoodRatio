import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { syncExternalShop } from '../slices/rightSidebarSlice';
import { highlightItem } from './exploringSidebarSlice';
import { parseCoordinates } from '../../models/editorModels';
// MapOverlayManager 직접 import 제거 - ModuleManager를 통해 비동기로 로드

/**
 * 맵 이벤트 관리를 위한 리덕스 슬라이스
 * 맵 이벤트 및 선택 상태 관리에 초점
 */

const initialState = {
  // 선택된 아이템 정보
  selectedItemId: null,
  currentSectionName: null,
  
  // 지도 이벤트 상태 추적
  lastEvent: null,     // 가장 최근에 발생한 이벤트 타입
  
  
  // 선택된 상점 아이템 (itemSelected 액션에서 사용)
  selectedShopItem: null,
  
  // 지도 이동 관련 상태 추가
  mapCenter: null,
  mapZoom: 15
};

// itemSelected 액션을 thunk로 구현
export const itemSelectedThunk = createAsyncThunk(
  'mapEvent/itemSelectedThunk',
  async ({ id, sectionName }, { dispatch }) => {
    // 액션을 디스패치하여 selectedItemId와 currentSectionName 업데이트
    dispatch(itemSelected({ id, sectionName }));
    
    // 아이템 하이라이트 액션 디스패치 (exploringSidebar에서 사용)
    dispatch(highlightItem(id));
    
    // 브라우저 환경에서만 실행
    if (typeof window !== 'undefined') {
      try {
        // ModuleManager 모듈 가져오기
        const ModuleManager = (await import('../../moduleManager')).default;
        
        // SectionDBManager 로드
        const sectionDBManager = await ModuleManager.loadGlobalModule('sectionDBManager');
        if (sectionDBManager) {
          console.log(`[MapEventSlice] 아이템 선택: ${id}, 섹션: ${sectionName}`);
          
          // SectionDBManager를 통해 아이템 정보 가져오기
          const selectedItem = await sectionDBManager.getItemByIDandSectionName(id, sectionName);
          
          // 아이템이 존재하면 syncExternalShop 액션 디스패치
          if (selectedItem && selectedItem.serverDataset) {
            dispatch(syncExternalShop({ itemdata: selectedItem.serverDataset })); //edit 상태일대의 return 처리는 내부에서
            
            // 아이템의 위치 정보가 있다면 지도 이동 액션 디스패치
            if (selectedItem.serverDataset.pinCoordinates) {
              try {
                // editorModels의 parseCoordinates 함수 사용
                const position = parseCoordinates(selectedItem.serverDataset.pinCoordinates);
                if (position) {
                  // 리덕스 상태 업데이트
                  dispatch(setMapView({ center: position, zoom: 18 }));
                  
                  // GoogleMapManager를 통해 지도 이동 처리
                  try {
                    const { panToLocation } = await import('../../map/GoogleMapManager');
                    await panToLocation(position, 18, true, () => {
                      console.log(`[MapEventSlice] 지도 이동 완료: lat=${position.lat}, lng=${position.lng}`);
                    });
                  } catch (mapError) {
                    console.error('[MapEventSlice] GoogleMapManager 이동 중 오류:', mapError);
                  }
                }
              } catch (error) {
                console.error('[MapEventSlice] 지도 이동을 위한 좌표 변환 중 오류:', error);
              }
            }
          } else {
            // 아이템이 없으면 null로 syncExternalShop 호출
            dispatch(syncExternalShop({ itemdata: null }));
          }
        } else {
          console.error('[MapEventSlice] SectionDBManager 모듈을 로드할 수 없습니다.');
          dispatch(syncExternalShop({ itemdata: null }));
        }
      } catch (error) {
        console.error('[MapEventSlice] 아이템 선택 중 오류:', error);
        dispatch(syncExternalShop({ itemdata: null }));
      }
    } else {
      // 서버 사이드에서는 아무것도 하지 않음
      console.warn('[MapEventSlice] 서버 사이드에서 실행 중입니다. SectionDBManager에 접근할 수 없습니다.');
    }
  }
);


export const curSectionChangedThunk = createAsyncThunk(
  'mapEvent/curSectionChangedThunk',
  async (sectionName, { dispatch, getState }) => {

     // 현재 섹션과 비교 (getState 파라미터 추가)
     const currentState = getState();
     const currentSectionName = currentState.mapEvent.currentSectionName;
     
     // 동일한 섹션으로 변경 시도하는 경우 무시
     if (currentSectionName === sectionName) {
       console.log(`[MapEventSlice] 이미 '${sectionName}' 섹션이 활성화되어 있습니다.`);
       return;
     }
    
    dispatch(curSectionChanged({ sectionName }));
    
    // 브라우저 환경에서만 실행
    if (typeof window !== 'undefined') {
      try {
        // ModuleManager 모듈 가져오기 (import 추가)
        const ModuleManager = (await import('../../moduleManager')).default;
        
        // SectionDBManager만 호출 (내부적으로 MapOverlayManager 제어)
        const sectionDBManager = await ModuleManager.loadGlobalModule('sectionDBManager');
        if (sectionDBManager) {
          console.log(`[MapEventSlice] 섹션 변경: ${sectionName}, SectionDBManager 데이터 로드`);
          // getSectionItems에서 내부적으로 MapOverlayManager의 changeSection 호출
          await sectionDBManager.getSectionItems(sectionName, true);
        }
      } catch (error) {
        console.error('[MapEventSlice] 섹션 변경 중 오류:', error);
        // 오류 처리를 위한 액션 디스패치 가능
      }
    }
  }
);

const mapEventSlice = createSlice({
  name: 'mapEvent',
  initialState,
  reducers: {
    // 특정 아이템이 선택된 액션 // // 글로벌 상태값 변경을 처리 - thunk부분에서 나머지 부분 처리중
    itemSelected: (state, action) => {
      const { id, sectionName } = action.payload;
      
      if (!id || !sectionName) {
        console.error('[MapEventSlice] itemSelected 액션에 필수 필드(id 또는 sectionName)가 누락되었습니다.');
        return;
      }
      
      state.selectedItemId = id;
      state.currentSectionName = sectionName;
      state.lastEvent = 'ITEM_SELECTED';
    },
    
    // 현재 섹션 변경 액션 // 글로벌 상태값 변경을 처리 - thunk부분에서 나머지 부분 처리중
    curSectionChanged: (state, action) => {
      const { sectionName } = action.payload;
      
      if (!sectionName) {
        console.error('[MapEventSlice] curSectionChanged 액션에 필수 필드(sectionName)가 누락되었습니다.');
        return;
      }
      
      // 상태 업데이트
      state.currentSectionName = sectionName;
      state.lastEvent = 'SECTION_CHANGED';
      
      
    },
    
    // 지도 뷰 설정 액션 (center와 zoom을 함께 처리)
    setMapView: (state, action) => {
      const { center, zoom } = action.payload;
      // center가 있을 경우에만 업데이트
      if (center !== undefined && center !== null) {
        state.mapCenter = center;
      }
      // zoom이 있을 경우에만 업데이트
      if (zoom !== undefined && zoom !== null) {
        state.mapZoom = zoom;
      }
    }
  }
});

// 액션 생성자 내보내기
export const {
  itemSelected,
  curSectionChanged,
  setMapView
} = mapEventSlice.actions;

// 선택자(selector) 함수 내보내기
export const selectLastMapEvent = (state) => state.mapEvent.lastEvent;


// 현재 선택된 아이템의 ID 가져오기 (없으면 null)
export const selectSelectedItemId = (state) => state.mapEvent.selectedItemId;
export const selectcurrentSectionName = (state) => state.mapEvent.currentSectionName;

// 지도 관련 선택자
export const selectMapCenter = (state) => state.mapEvent.mapCenter;
export const selectMapZoom = (state) => state.mapEvent.mapZoom;

// 리듀서 내보내기
export default mapEventSlice.reducer; 