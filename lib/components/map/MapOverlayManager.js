/**
 * 간소화된 MapOverlayManager 구현
 * 
 * 섹션 및 카테고리별로 오버레이를 관리하고, 객체 직접 탐색을 통해
 * 오버레이 가시성을 효율적으로 관리하는 클래스입니다.
 * 
 * === 가시성 관리 목표 ===
 * 
 * 1. LAYER_CONSTANTS 상수에 정의된 각 레이어 타입별 줌 레벨 범위(MIN_ZOOM, MAX_ZOOM)를 
 *    기준으로 가시성을 결정합니다.
 * 
 * 2. 현재 줌 레벨이 특정 레이어의 범위에 들어오면 해당 레이어의 가시성을 활성화(true)하고,
 *    범위를 벗어나면 비활성화(false)합니다.
 * 
 * 3. _overlaysBySections 구조 내의 각 섹션별 overlayVisibles 객체의 상태값을 
 *    이 규칙에 따라 업데이트합니다.
 * 
 * 4. 레이어별 일괄 처리: 개별 오버레이에 접근하지 않고, 레이어 단위로 모든 오버레이의 
 *    가시성을 일괄적으로 업데이트하여 처리 효율성을 향상시킵니다.
 * 
 * 5. 객체 자체 토글 활용: 각 오버레이 객체는 자체 toggleVisible() 함수를 통해 
 *    가시성을 제어합니다. overlayVisibles 상태가 변경될 때 해당 레이어의 
 *    모든 오버레이 객체의 toggleVisible()을 호출하여 상태를 반전시킵니다.
 * 
 * === 오버레이 가시성 토글 구현 ===
 * 
 * 1. 각 오버레이 객체 생성 시 toggleVisible() 함수 추가:
 *    - 객체 내부에 private 상태로 가시성 유지 (클로저 활용)
 *    - 외부에서는 상태 직접 접근 불가, 토글 함수만 호출 가능
 *    - 인자 없이 호출하여 내부 상태를 반전시키는 순수 토글 기능
 *    - 어떤 인자도 받지 않음 - 인자를 전달해도 무시됨
 * 
 * 2. 상점 마커(AdvancedMarkerElement): style.display로 가시성 제어
 *    - toggleVisible(): 내부 상태 반전 및 style.display 설정
 * 
 * 3. 상점 폴리곤(Polygon): setVisible() 메서드로 가시성 제어
 *    - toggleVisible(): 내부 상태 반전 및 setVisible() 호출
 * 
 * 4. 랜드마크 이미지 마커(AdvancedMarkerElement): style.display로 가시성 제어
 *    - imageMarkers 배열만 사용
 * 
 * 5. 핫스팟 이미지 마커(AdvancedMarkerElement): style.display로 가시성 제어
 *    - imageMarkers 배열만 사용
 * 
 * === 레이어 타입별 객체 형태 ===
 * 
 * 1. 상점 마커(SHOPS_MARKER): google.maps.marker.AdvancedMarkerElement
 *    - PinElement 기반, style.display로 가시성 제어
 * 
 * 2. 상점 폴리곤(SHOPS_POLYGON): google.maps.Polygon
 *    - 좌표 배열 기반, setVisible()로 가시성 제어
 * 
 * 3. 랜드마크 마커(LANDMARKS_MARKER): google.maps.marker.AdvancedMarkerElement
 *    - 이미지 요소 기반, style.display로 가시성 제어
 * 
 * 4. 핫스팟 마커(HOTSPOTS_MARKER): google.maps.marker.AdvancedMarkerElement
 *    - 커스텀 스타일 마커, style.display로 가시성 제어
 * 
 * === 목표 명세 ===
 * 
 * 1. 데이터 구조:
 *    _overlaysBySections = {
 *      [섹션명]: {
 *        overlayVisibles: {
 *          shopsMarker: boolean,
 *          shopsPolygon: boolean,
 *          landmarksMarker: boolean,
 *          hotspotsMarker: boolean
 *        },
 *        shops: {
 *          markers: [...마커 객체 배열],
 *          polygons: [...폴리곤 객체 배열]
 *        },
 *        landmarks: {
 *          imageMarkers: [...이미지마커 객체 배열]
 *        },
 *        hotspots: {
 *          imageMarkers: [...이미지마커 객체 배열]
 *        }
 *      }
 *    }
 * 
 * 2. 접근 방식:
 *    - Id를 통한 개별 오버레이 객체는 접근하지 않음
 *    - 레이어별 일괄 순회만 동작함
 * 
 * 3. 가시성 관리 로직:
 *    - 줌 레벨 변경 시 _updateVisibilityForZoom() 호출
 *    - 현재 줌 레벨에 따라 각 레이어의 표시 여부 결정
 *    - 섹션 변경 시 이전 섹션 숨김, 새 섹션의 오버레이 표시 //차후 다수의 섹션을 지원할 예정 
 * 
 * 4. 작동 순서:
 *    - initialize(): 맵 인스턴스 설정, 이벤트 리스너 등록
 *    - registerOverlaysByItemlist(): 아이템 리스트로 오버레이 등록 및 toggleVisible 함수 추가
 *    - changeSection(): 활성 섹션 변경
 *    - _updateVisibilityForZoom(): 줌 레벨에 따른 overlayVisibles 상태 업데이트
 *    - _toggleLayerVisibility(): overlayVisibles 상태 변경 시 레이어별 오버레이 일괄 토글
 * 
 * 5. 토글 기능 작동 방식:
 *    - overlayVisibles 상태가 변경될 때만 해당 레이어의 오버레이들을 일괄 토글
 *    - 각 오버레이는 자체 내부 상태를 관리하고 토글 함수 호출 시 상태 반전
 *    - toggleVisible()은 항상 인자 없이 호출되며, 현재 상태의 반대로만 전환 가능
 *    - 상태를 특정 값으로 설정하는 기능 없음 (순수 토글만 가능)
 */

import OverlayService from './OverlayService';

/**
 * 오버레이 레이어 상수 정의
 */
const LAYER_CONSTANTS = {
  SHOPS_MARKER: { 
    name: 'SHOPS_MARKER',
    MIN_ZOOM: 12,
    MAX_ZOOM: 16,
    section: 'shops',           // 데이터가 저장된 섹션 키
    collection: 'markers',      // 컬렉션 키
    overlayVisibleKey: 'shopsMarker' // overlayVisibles의 키
  },
  SHOPS_POLYGON: { 
    name: 'SHOPS_POLYGON',
    MIN_ZOOM: 16, 
    MAX_ZOOM: 20,
    section: 'shops',
    collection: 'polygons',
    overlayVisibleKey: 'shopsPolygon'
  },
  LANDMARKS_MARKER: { 
    name: 'LANDMARKS_MARKER',
    MIN_ZOOM: 10,
    MAX_ZOOM: 19,
    section: 'landmarks',
    collection: 'imageMarkers',
    overlayVisibleKey: 'landmarksMarker'
  },
  HOTSPOTS_MARKER: { 
    name: 'HOTSPOTS_MARKER',
    MIN_ZOOM: 14,
    MAX_ZOOM: 21,
    section: 'hotspots',
    collection: 'imageMarkers',
    overlayVisibleKey: 'hotspotsMarker'
  }
};

/**
 * 간소화된 MapOverlayManager
 */
const MapOverlayManager = {
  // 오버레이 레이어 타입 상수
  SHOPS_MARKER: 'shopsMarker',
  SHOPS_POLYGON: 'shopsPolygon',
  LANDMARKS_MARKER: 'landmarksMarker',
  HOTSPOTS_MARKER: 'hotspotsMarker',
  
  // 내부 상태
  _mapInstance: null,        // Google 맵 인스턴스
  _activeSection: null,      // 현재 활성화된 섹션 이름
  _overlaysBySections: {},    // 오버레이 그룹 (섹션별 카테고리별 오버레이 저장)
  _zoomListener: null,       // 줌 이벤트 리스너
  
  // 현재 줌 레벨
  _currentZoom: 15,
  
  /**
   * 초기화
   * @param {Object} mapInstance - Google 맵 인스턴스
   */
  initialize: function(mapInstance) {
    console.log('[DEBUG] MapOverlayManager 초기화');
    
    if (!mapInstance) {
      console.error('[ERROR] 맵 인스턴스가 제공되지 않음. 초기화 중단');
      return;
    }
    
    this._mapInstance = mapInstance;
    this._overlaysBySections = {};
    this._activeSection = null;
    
    // 줌 변경 이벤트 리스너 - 화살표 함수로 변경하여 this 컨텍스트 유지
    this._zoomListener = google.maps.event.addListener(
      this._mapInstance,
      'zoom_changed',
      () => {
        const newZoom = this._mapInstance.getZoom();
        console.log(`[DEBUG] 줌 레벨 변경됨: ${newZoom}`);
        this._updateVisibilityForZoom();
      }
    );
    
    console.log('[DEBUG] MapOverlayManager 초기화 완료');

    // 테스트용 마커 생성
    const testMarker = OverlayService.createMarker(
      { lat: 35.86838, lng: 128.59686 }, // 대구 반월당 좌표
      '테스트 마커',
      { 
        color: '#FF5722', // 주황색 마커
        zIndex: 20, // 다른 마커들보다 위에 표시
        map: this._mapInstance // 맵에 직접 연결
      }
    );
    
    // 테스트 마커를 보이게 설정
    if (testMarker) {
      if (!testMarker.style) testMarker.style = {};
      testMarker.style.display = 'block'; // 항상 보이도록 설정
      console.log('[DEBUG] 테스트 마커 생성 완료 (대구 반월당 좌표)');
    }
  },
  
  /**
   * 좌표 객체를 Google Maps LatLng 객체로 단순 변환 (입력은 항상 {lat, lng} 형식)
   * @param {Object} coordinates - 좌표 객체 ({lat, lng} 형식)
   * @returns {google.maps.LatLng} 변환된 좌표 객체
   */
  parseCoordinates: function(coordinates) {
    // 이미 LatLng 객체인 경우 그대로 반환
    if (coordinates instanceof google.maps.LatLng) {
      return coordinates;
    }
    
    // lat, lng 객체를 LatLng로 변환
    return new google.maps.LatLng(coordinates.lat, coordinates.lng);
  },
  
  /**
   * 활성 섹션 변경
   * @param {string} sectionName - 새 섹션 이름
   * @returns {boolean} 성공 여부
   */
  changeSection: function(sectionName) {
    console.log(`[DEBUG] 활성 섹션 변경 시도: '${this._activeSection}' -> '${sectionName}'`);
    
    if (!sectionName) {
      console.error('[ERROR] 섹션 변경 실패: 섹션 이름이 제공되지 않았습니다');
      return false;
    }
    
    // 변경할 필요가 없는 경우 (동일한 섹션)
    if (this._activeSection === sectionName) {
      console.log(`[DEBUG] 섹션 변경 건너뜀: 이미 활성화된 섹션 '${sectionName}'`);
      return true;
    }
    
    // 대상 섹션이 존재하는지 확인
    if (!this._overlaysBySections[sectionName]) {
      console.error(`[ERROR] 섹션 변경 실패: 섹션 '${sectionName}'이 존재하지 않습니다`);
      return false;
    }
    
    const startTime = performance.now(); // 성능 측정 시작
    
    // 이전 섹션 숨기기
    if (this._activeSection && this._overlaysBySections[this._activeSection]) {
      this._hideAllOverlaysInSection(this._activeSection);
    }
    
    // 활성 섹션 업데이트
    this._activeSection = sectionName;
    
    // 줌 레벨에 따른 가시성 업데이트 트리거
    this._updateVisibilityForZoom();
    
    const endTime = performance.now(); // 성능 측정 종료
    const elapsedTime = endTime - startTime;
    
    console.log(`[DEBUG] 섹션 변경 완료: '${sectionName}' (${elapsedTime.toFixed(2)}ms)`);
    return true;
  },
  
  /**
   * 섹션의 모든 오버레이 숨기기
   * @param {string} sectionName - 섹션 이름
   * @private
   */
  _hideAllOverlaysInSection: function(sectionName) {
    const section = this._overlaysBySections[sectionName];
    
    if (!section) {
      console.warn(`[WARN] 섹션 '${sectionName}' 숨기기 실패: 섹션이 존재하지 않습니다`);
      return;
    }
    
    console.log(`[DEBUG] 섹션 '${sectionName}'의 모든 오버레이 숨기기 시작`);
    
    // 상점 마커 숨기기
    if (section.shops && Array.isArray(section.shops.markers)) {
      section.shops.markers.forEach(marker => {
        if (marker && typeof marker.toggleVisible === 'function') {
          // 현재 가시 상태인 경우에만 토글
          if (marker.getVisible && marker.getVisible()) {
            marker.toggleVisible();
          }
        }
      });
    }
    
    // 상점 폴리곤 숨기기
    if (section.shops && Array.isArray(section.shops.polygons)) {
      section.shops.polygons.forEach(polygon => {
        if (polygon && typeof polygon.toggleVisible === 'function') {
          // 현재 가시 상태인 경우에만 토글
          if (polygon.getVisible && polygon.getVisible()) {
            polygon.toggleVisible();
          }
        }
      });
    }
    
    // 랜드마크 숨기기
    if (section.landmarks && Array.isArray(section.landmarks.imageMarkers)) {
      section.landmarks.imageMarkers.forEach(marker => {
        if (marker && typeof marker.toggleVisible === 'function') {
          // 현재 가시 상태인 경우에만 토글
          if (marker.getVisible && marker.getVisible()) {
            marker.toggleVisible();
          }
        }
      });
    }
    
    // 핫스팟 숨기기
    if (section.hotspots && Array.isArray(section.hotspots.imageMarkers)) {
      section.hotspots.imageMarkers.forEach(marker => {
        if (marker && typeof marker.toggleVisible === 'function') {
          // 현재 가시 상태인 경우에만 토글
          if (marker.getVisible && marker.getVisible()) {
            marker.toggleVisible();
          }
        }
      });
    }
    
    // 모든 가시성 상태 false로 설정
    if (section.overlayVisibles) {
      Object.keys(section.overlayVisibles).forEach(key => {
        section.overlayVisibles[key] = false;
      });
    }
    
    console.log(`[DEBUG] 섹션 '${sectionName}'의 모든 오버레이 숨기기 완료`);
  },
  
  /**
   * 현재 표시 중인 오버레이 ID 가져오기
   * @returns {Object} 레이어별 표시 중인 오버레이 ID 목록
   */
  getVisibleOverlayIds: function() {
    if (!this._activeSection || !this._overlaysBySections[this._activeSection]) {
      console.warn(`[WARN] 활성 섹션이 없거나 오버레이가 등록되지 않음: ${this._activeSection}`);
      return { 
        shops: { markers: [], polygons: [] }, 
        landmarks: [], 
        hotspots: [] 
      };
    }
    
    const section = this._overlaysBySections[this._activeSection];
    const result = {
      shops: {
        markers: [],
        polygons: []
      },
      landmarks: [],
      hotspots: []
    };
    
    // 상점 마커 ID 가져오기 - 배열 순회
    if (section.shops && Array.isArray(section.shops.markers)) {
      // 배열에서 visible 상태인 마커의 ID만 필터링
      result.shops.markers = section.shops.markers
        .filter(marker => marker && marker.getVisible && marker.getVisible())
        .map(marker => marker.itemInfo ? marker.itemInfo.id : null)
        .filter(id => id !== null);
    }
    
    // 상점 폴리곤 ID 가져오기 - 배열 순회
    if (section.shops && Array.isArray(section.shops.polygons)) {
      // 배열에서 visible 상태인 폴리곤의 ID만 필터링
      result.shops.polygons = section.shops.polygons
        .filter(polygon => polygon && polygon.getVisible && polygon.getVisible())
        .map(polygon => polygon.get ? polygon.get('itemId') : null)
        .filter(id => id !== null);
    }
    
    // 랜드마크 ID 가져오기 - 배열 순회
    if (section.landmarks && Array.isArray(section.landmarks.imageMarkers)) {
      // 배열에서 visible 상태인 마커의 ID만 필터링
      result.landmarks = section.landmarks.imageMarkers
        .filter(marker => marker && marker.getVisible && marker.getVisible())
        .map(marker => marker.itemInfo ? marker.itemInfo.id : null)
        .filter(id => id !== null);
    }
    
    // 핫스팟 ID 가져오기 - 배열 순회
    if (section.hotspots && Array.isArray(section.hotspots.imageMarkers)) {
      // 배열에서 visible 상태인 마커의 ID만 필터링
      result.hotspots = section.hotspots.imageMarkers
        .filter(marker => marker && marker.getVisible && marker.getVisible())
        .map(marker => marker.itemInfo ? marker.itemInfo.id : null)
        .filter(id => id !== null);
    }
    
    console.log(`[DEBUG] 현재 표시 중인 오버레이: 상점 마커=${result.shops.markers.length}, 상점 폴리곤=${result.shops.polygons.length}, 랜드마크=${result.landmarks.length}, 핫스팟=${result.hotspots.length}`);
    
    return result;
  },
  
  /**
   * 현재 활성 섹션의 아이템 ID 가져오기
   * @returns {Object} 카테고리별 아이템 ID 목록
   */
  getActiveItemIds: function() {
    if (!this._activeSection || !this._overlaysBySections[this._activeSection]) {
      console.warn(`[WARN] 활성 섹션이 없거나 오버레이가 등록되지 않음: ${this._activeSection}`);
      return { shops: [], landmarks: [], hotspots: [] };
    }
    
    const section = this._overlaysBySections[this._activeSection];
    const result = {
      shops: [],
      landmarks: [],
      hotspots: []
    };
    
    // 상점 ID 가져오기 - 배열에서 ID 추출
    if (section.shops && Array.isArray(section.shops.markers)) {
      result.shops = section.shops.markers
        .map(marker => marker.itemInfo ? marker.itemInfo.id : null)
        .filter(id => id !== null);
    }
    
    // 랜드마크 ID 가져오기 - 배열에서 ID 추출
    if (section.landmarks && Array.isArray(section.landmarks.imageMarkers)) {
      result.landmarks = section.landmarks.imageMarkers
        .map(marker => marker.itemInfo ? marker.itemInfo.id : null)
        .filter(id => id !== null);
    }
    
    // 핫스팟 ID 가져오기 - 배열에서 ID 추출
    if (section.hotspots && Array.isArray(section.hotspots.imageMarkers)) {
      result.hotspots = section.hotspots.imageMarkers
        .map(marker => marker.itemInfo ? marker.itemInfo.id : null)
        .filter(id => id !== null);
    }
    
    console.log(`[DEBUG] 활성 섹션(${this._activeSection})의 아이템 ID: 상점=${result.shops.length}, 랜드마크=${result.landmarks.length}, 핫스팟=${result.hotspots.length}`);
    
    return result;
  },
  
  /**
   * 전체 정리 (컴포넌트 언마운트시 호출)
   */
  cleanup: function() {
    console.log('[DEBUG] 오버레이 매니저 정리 시작');
    
    // 이벤트 리스너 제거
    if (this._mapInstance) {
      if (this._zoomListener) {
        google.maps.event.removeListener(this._zoomListener);
        this._zoomListener = null;
      }
    }
    
    // 모든 섹션의 오버레이 정리
    Object.keys(this._overlaysBySections).forEach(sectionName => {
      this._hideAllOverlaysInSection(sectionName);
      
      // 맵에서 오버레이 제거 - 배열 기반으로 수정
      const section = this._overlaysBySections[sectionName];
      
      // 상점 마커 제거
      if (section.shops && Array.isArray(section.shops.markers)) {
        section.shops.markers.forEach(overlay => {
          if (overlay && typeof overlay.setMap === 'function') {
            overlay.setMap(null);
          }
        });
        section.shops.markers = [];
      }
      
      // 상점 폴리곤 제거
      if (section.shops && Array.isArray(section.shops.polygons)) {
        section.shops.polygons.forEach(overlay => {
          if (overlay && typeof overlay.setMap === 'function') {
            overlay.setMap(null);
          }
        });
        section.shops.polygons = [];
      }
      
      // 랜드마크 제거
      if (section.landmarks && Array.isArray(section.landmarks.imageMarkers)) {
        section.landmarks.imageMarkers.forEach(overlay => {
          if (overlay && typeof overlay.setMap === 'function') {
            overlay.setMap(null);
          }
        });
        section.landmarks.imageMarkers = [];
      }
      
      // 핫스팟 제거
      if (section.hotspots && Array.isArray(section.hotspots.imageMarkers)) {
        section.hotspots.imageMarkers.forEach(overlay => {
          if (overlay && typeof overlay.setMap === 'function') {
            overlay.setMap(null);
          }
        });
        section.hotspots.imageMarkers = [];
      }
    });
    
    // 데이터 초기화
    this._overlaysBySections = {};
    this._activeSection = null;
    this._mapInstance = null;
    
    console.log('[DEBUG] 오버레이 매니저 정리 완료');
  },
  
  /**
   * 상점 마커 생성
   * @param {Object} item - 상점 데이터
   * @returns {google.maps.marker.AdvancedMarkerElement} 생성된 마커
   * @private
   */
  _createShopMarker: function(item) {
    // OverlayService를 통해 마커 생성
    console.log(item.pinCoordinates);
    const marker = OverlayService.createMarker(
      item.pinCoordinates, 
      item.name,
      { 
        color: '#FF5722', // 주황색 마커
        zIndex: 20,
        map: this._mapInstance // 맵 인스턴스 연결
      }
    );
    
    if (!marker) {
      console.error(`[ERROR] 상점 마커 생성 실패: ${item.id || '알 수 없음'}`);
      return null;
    }
    
    // 클로저를 이용한 private 상태 관리
    const state = {
      isVisible: false // 초기 상태는 숨김
    };
    
    // 토글 함수 추가 - 인자를 받지 않고 내부 상태만 전환
    marker.toggleVisible = function() {
      state.isVisible = !state.isVisible;
      
      if (!this.style) this.style = {};
      this.style.display = state.isVisible ? 'block' : 'none';
    };
    
    // 아이템 정보 저장
    marker.itemInfo = {
      id: item.id,
      type: 'shop',
      sectionName: this._activeSection
    };
    
    // getVisible 메소드 추가
    marker.getVisible = function() {
      return state.isVisible;
    };
    
    return marker;
  },
  
  /**
   * 상점 폴리곤 생성
   * @param {Object} item - 상점 데이터
   * @returns {google.maps.Polygon} 생성된 폴리곤
   * @private
   */
  _createShopPolygon: function(item) {
    // OverlayService를 통해 폴리곤 생성
    const polygon = OverlayService.createPolygon(
      item.path,
      { 
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.35,
        zIndex: 5,
        map: this._mapInstance // 맵 인스턴스 연결
      }
    );
    
    if (!polygon) {
      console.error(`[ERROR] 상점 폴리곤 생성 실패: ${item.id || '알 수 없음'}`);
      return null;
    }
    
    // 클로저를 이용한 private 상태 관리
    const state = {
      isVisible: false // 초기 상태는 숨김
    };
    
    // 토글 함수 추가 - 인자를 받지 않고 내부 상태만 전환
    polygon.toggleVisible = function() {
      state.isVisible = !state.isVisible;
      this.setVisible(state.isVisible);
    };
    
    // 아이템 ID와 섹션 이름 메타데이터 저장
    polygon.set('itemId', item.id);
    polygon.set('sectionName', this._activeSection || '');
    
    // getVisible 메소드 추가 - 기본 getVisible이 없을 경우 대비
    const originalGetVisible = polygon.getVisible;
    polygon.getVisible = function() {
      return typeof originalGetVisible === 'function' ? originalGetVisible.call(this) : state.isVisible;
    };
    
    return polygon;
  },
  
  /**
   * 랜드마크 이미지 마커 생성
   * @param {Object} item - 랜드마크 데이터
   * @returns {google.maps.marker.AdvancedMarkerElement} 생성된 이미지 마커
   * @private
   */
  _createLandmarkImageMarker: function(item) {
    // OverlayService를 통해 이미지 마커 생성
    const imageMarker = OverlayService.createImageMarker(
      this._mapInstance, // 명시적으로 맵 인스턴스 전달
      item.pinCoordinates,
      item.pictureIcon || item.imageUrl,
      { 
        width: 40, 
        height: 40,
        zIndex: 15,
        title: item.name,
        itemInfo: {
          id: item.id,
          type: 'landmark',
          sectionName: this._activeSection
        }
      }
    );
    
    if (!imageMarker) {
      console.error(`[ERROR] 랜드마크 이미지 마커 생성 실패: ${item.id || '알 수 없음'}`);
      return null;
    }
    
    // 클로저를 이용한 private 상태 관리
    const state = {
      isVisible: false // 초기 상태는 숨김
    };
    
    // 토글 함수 추가 - 인자를 받지 않고 내부 상태만 전환
    imageMarker.toggleVisible = function() {
      state.isVisible = !state.isVisible;
      
      if (!this.style) this.style = {};
      this.style.display = state.isVisible ? 'block' : 'none';
    };
    
    // 아이템 정보 저장
    imageMarker.itemInfo = {
      id: item.id,
      type: 'landmark',
      sectionName: this._activeSection
    };
    
    // getVisible 메소드 추가
    imageMarker.getVisible = function() {
      return state.isVisible;
    };
    
    return imageMarker;
  },
  
  /**
   * 핫스팟 이미지 마커 생성
   * @param {Object} item - 핫스팟 데이터
   * @returns {google.maps.marker.AdvancedMarkerElement} 생성된 이미지 마커
   * @private
   */
  _createHotspotImageMarker: function(item) {
    // OverlayService를 통해 이미지 마커 생성
    const imageMarker = OverlayService.createImageMarker(
      this._mapInstance, // 명시적으로 맵 인스턴스 전달
      item.pinCoordinates,
      item.pictureIcon || item.imageUrl,
      { 
        width: 48, 
        height: 48,
        zIndex: 12,
        title: item.name,
        itemInfo: {
          id: item.id,
          type: 'hotspot',
          sectionName: this._activeSection
        }
      }
    );
    
    if (!imageMarker) {
      console.error(`[ERROR] 핫스팟 이미지 마커 생성 실패: ${item.id || '알 수 없음'}`);
      return null;
    }
    
    // 클로저를 이용한 private 상태 관리
    const state = {
      isVisible: false // 초기 상태는 숨김
    };
    
    // 토글 함수 추가 - 인자를 받지 않고 내부 상태만 전환
    imageMarker.toggleVisible = function() {
      state.isVisible = !state.isVisible;
      
      if (!this.style) this.style = {};
      this.style.display = state.isVisible ? 'block' : 'none';
    };
    
    // 아이템 정보 저장
    imageMarker.itemInfo = {
      id: item.id,
      type: 'hotspot',
      sectionName: this._activeSection
    };
    
    // getVisible 메소드 추가
    imageMarker.getVisible = function() {
      return state.isVisible;
    };
    
    return imageMarker;
  },
  
  /**
   * 섹션별 아이템 리스트에 대한 오버레이 등록
   * @param {string} sectionName - 섹션 이름
   * @param {Array} itemList - protoServeDataset형태의 item들의 리스트, 배열 형태 [ {}, {}, {} ]
   * @returns {boolean} 성공 여부
   */
  registerOverlaysByItemlist: function(sectionName, itemList) {
    console.log(`[DEBUG] 오버레이 등록 시작: 섹션 '${sectionName}'`);
    
    // 배열 체크
    if (!Array.isArray(itemList)) {
      console.error(`[ERROR] 오버레이 등록 실패: 항목 리스트가 배열이 아닙니다.`);
      return false;
    }
    
    // 섹션 초기화 - 아직 해당 섹션이 없는 경우에만 초기화
    if (!this._overlaysBySections[sectionName]) {
      this._overlaysBySections[sectionName] = {
        overlayVisibles: {
          shopsMarker: false,
          shopsPolygon: false,
          landmarksMarker: false,
          hotspotsMarker: false
        },
        shops: {
          markers: [],
          polygons: []
        },
        landmarks: {
          imageMarkers: []
        },
        hotspots: {
          imageMarkers: []
        }
      };
    }
    
    const section = this._overlaysBySections[sectionName];
    const startTime = performance.now(); // 성능 측정 시작
    
    // 각 카테고리별 오버레이 등록 결과 카운트
    let results = {
      shops: { markers: 0, polygons: 0 },
      landmarks: { imageMarkers: 0 },
      hotspots: { imageMarkers: 0 }
    };
    
    // 모든 아이템을 카테고리 필드에 따라 분류하여 처리
    for (const item of itemList) {
      const category = item.category || 'shops'; // 카테고리가 없으면 기본값 'shops'
      
      // 카테고리에 따라 다른 처리
      if (category === 'shops') {
        // 상점 마커 생성 및 등록
        if (item.pinCoordinates) {
          const marker = this._createShopMarker(item);
          if (marker) {
            section.shops.markers.push(marker);
            results.shops.markers++;
          }
        }
        
        // 상점 폴리곤 생성 및 등록
        if (item.path?.length >= 3) {
          const polygon = this._createShopPolygon(item);
          if (polygon) {
            section.shops.polygons.push(polygon);
            results.shops.polygons++;
          }
        }
      } else if (category === 'landmarks') {
        // 랜드마크 이미지 마커 생성 및 등록
        if (item.pinCoordinates) {
          const imageMarker = this._createLandmarkImageMarker(item);
          if (imageMarker) {
            section.landmarks.imageMarkers.push(imageMarker);
            results.landmarks.imageMarkers++;
          }
        }
      } else if (category === 'hotspots') {
        // 핫스팟 이미지 마커 생성 및 등록
        if (item.pinCoordinates) {
          const imageMarker = this._createHotspotImageMarker(item);
          if (imageMarker) {
            section.hotspots.imageMarkers.push(imageMarker);
            results.hotspots.imageMarkers++;
          }
        }
      }
    }
    
    const endTime = performance.now(); // 성능 측정 종료
    const elapsedTime = endTime - startTime;
    
    // 결과 요약
    console.log(`[DEBUG] 오버레이 등록 완료 (${elapsedTime.toFixed(2)}ms):
      상점: 마커=${results.shops.markers}, 폴리곤=${results.shops.polygons}
      랜드마크: 이미지마커=${results.landmarks.imageMarkers}
      핫스팟: 이미지마커=${results.hotspots.imageMarkers}`);
    
    // 활성 섹션이 아직 없는 경우 현재 섹션을 활성 섹션으로 설정
    // TODO 오버레이용 섹션 관리 조정 필요. 현재는 생성시 등록됨. 
    
      this._activeSection = sectionName;
      // 줌 레벨에 따른 가시성 업데이트 트리거
      this._updateVisibilityForZoom();
    
    
    return true;
  },
  
  /**
   * 레이어 타입에 해당하는 오버레이 배열 가져오기
   * @param {string} sectionName - 섹션 이름
   * @param {string} layerType - 레이어 타입 (this.SHOPS_MARKER 등)
   * @returns {Array} 오버레이 배열
   * @private
   */
  _getLayerOverlays: function(sectionName, layerType) {
    if (!sectionName || !layerType || !this._overlaysBySections[sectionName]) {
      return [];
    }
    
    const section = this._overlaysBySections[sectionName];
    let layerInfo = null;
    
    // 레이어 타입에 해당하는 레이어 정보 찾기
    Object.values(LAYER_CONSTANTS).forEach(info => {
      if (info.overlayVisibleKey === layerType) {
        layerInfo = info;
      }
    });
    
    if (!layerInfo) {
      console.warn(`[WARN] 알 수 없는 레이어 타입: ${layerType}`);
      return [];
    }
    
    // 섹션 내 해당 카테고리와 컬렉션에 접근하여 오버레이 배열 가져오기
    const category = section[layerInfo.section];
    if (!category) {
      return [];
    }
    
    const collection = category[layerInfo.collection];
    if (!Array.isArray(collection)) {
      return [];
    }
    
    return collection; // 배열 그대로 반환
  },
  
  /**
   * 레이어 가시성을 토글합니다 (특정 섹션의 특정 레이어 타입)
   * @param {string} sectionName - 섹션 이름
   * @param {string} layerType - 레이어 타입 (SHOPS_MARKER, SHOPS_POLYGON 등)
   * @return {boolean} 성공 여부
   * @private
   */
  _toggleLayerVisibility: function(sectionName, layerType) {
    console.time(`_toggleLayerVisibility_${layerType}`);
    console.log(`[DEBUG] 레이어 가시성 토글 시작: ${layerType} (섹션: ${sectionName})`);
    
    if (!sectionName || !layerType) {
      console.error('[ERROR] 레이어 가시성 토글 실패: 섹션 이름 또는 레이어 타입이 제공되지 않았습니다');
      return false;
    }
    
    const section = this._overlaysBySections[sectionName];
    
    if (!section) {
      console.error(`[ERROR] 레이어 가시성 토글 실패: 섹션 '${sectionName}'이 존재하지 않습니다`);
      return false;
    }
    
    const layerInfo = LAYER_CONSTANTS[layerType];
    
    if (!layerInfo) {
      console.error(`[ERROR] 레이어 가시성 토글 실패: 알 수 없는 레이어 타입 '${layerType}'`);
      return false;
    }
    
    const overlayVisibleKey = layerInfo.overlayVisibleKey;
    
    // 현재 가시성과 목표 가시성 계산
    const currentVisibility = section.overlayVisibles[overlayVisibleKey];
    const targetVisibility = !currentVisibility; // 목표는 현재와 반대
    
    console.log(`[DEBUG] 레이어 가시성 변경: ${layerType}, 현재=${currentVisibility}, 목표=${targetVisibility}`);
    
    let overlays = [];
    let successCount = 0;
    let failCount = 0;
    
    // 레이어 타입에 따른 오버레이 배열 가져오기 - layerInfo 사용하여 수정
    const sectionCategory = layerInfo.section;
    const collectionName = layerInfo.collection;
    
    // section 내에서 해당 카테고리와 컬렉션이 존재하는지 확인
    if (section[sectionCategory] && Array.isArray(section[sectionCategory][collectionName])) {
      overlays = section[sectionCategory][collectionName];
      console.log(`[DEBUG] 오버레이 배열 가져옴: ${sectionCategory}.${collectionName}, 개수=${overlays.length}`);
    } else {
      console.warn(`[WARN] 오버레이 배열을 찾을 수 없음: ${sectionCategory}.${collectionName}`);
    }
    
    // 오버레이 배열 반복하며 가시성 토글
    overlays.forEach((overlay, index) => {
      if (overlay && typeof overlay.toggleVisible === 'function') {
        try {
          // 현재 가시성 확인
          const isCurrentlyVisible = overlay.getVisible ? overlay.getVisible() : false;
          
          // 목표 가시성과 다를 경우에만 토글
          if (isCurrentlyVisible !== targetVisibility) {
            overlay.toggleVisible();
            successCount++;
          } else {
            // 이미 목표 가시성 상태인 경우
            successCount++;
          }
          
          // 첫 번째 오버레이의 상태 로깅 (디버깅용)
          if (index === 0) {
            const isVisible = overlay.getVisible ? overlay.getVisible() : 'unknown';
            console.log(`[DEBUG] 첫 번째 오버레이 상태: id=${overlay.itemInfo?.id || 'unknown'}, visible=${isVisible}`);
          }
        } catch (error) {
          console.error(`[ERROR] 오버레이 토글 중 오류 발생: ${error.message}`);
          failCount++;
        }
      } else {
        if (!overlay) {
          console.warn(`[WARN] 오버레이 객체가 없음 (인덱스: ${index})`);
        } else if (typeof overlay.toggleVisible !== 'function') {
          console.warn(`[WARN] toggleVisible 함수가 없는 오버레이: ${overlay.constructor.name || typeof overlay}`);
        }
        failCount++;
      }
    });
    
    console.log(`[DEBUG] 레이어 가시성 토글 완료: ${layerType} (섹션: ${sectionName}, 새 상태: ${targetVisibility ? '보임' : '숨김'}, 성공: ${successCount}, 실패: ${failCount})`);
    console.timeEnd(`_toggleLayerVisibility_${layerType}`);
    
    return true;
  },
  
  /**
   * 줌 레벨에 따른 레이어 가시성 업데이트
   * @private
   */
  _updateVisibilityForZoom: function() {
    if (!this._mapInstance) {
      console.error('[ERROR] 가시성 업데이트 실패: 맵 인스턴스가 없습니다');
      return;
    }
    
    if (!this._activeSection) {
      console.warn('[WARN] 가시성 업데이트 건너뜀: 활성 섹션이 없습니다');
      return;
    }
    
    const section = this._overlaysBySections[this._activeSection];
    if (!section) {
      console.warn(`[WARN] 가시성 업데이트 실패: 섹션 '${this._activeSection}'이 존재하지 않습니다`);
      return;
    }
    
    // 현재 줌 레벨 가져오기
    const currentZoom = this._mapInstance.getZoom();
    if (typeof currentZoom !== 'number') {
      console.error('[ERROR] 가시성 업데이트 실패: 유효하지 않은 줌 레벨');
        return;
      }
      
    console.log(`[DEBUG] 줌 레벨에 따른 가시성 업데이트: 줌 레벨 = ${currentZoom}`);
    
    // 이전 가시성 상태 로그
    console.log('[DEBUG] 업데이트 전 overlayVisibles 상태:', JSON.stringify(section.overlayVisibles));
    
    // 이전 가시성 상태 저장 (변경 여부 확인용)
    const prevVisibilityState = JSON.parse(JSON.stringify(section.overlayVisibles));
    
    // 각 레이어의 가시성 업데이트
    Object.entries(LAYER_CONSTANTS).forEach(([layerType, layerInfo]) => {
      const shouldBeVisible = (
        currentZoom >= layerInfo.MIN_ZOOM && 
        currentZoom <= layerInfo.MAX_ZOOM
      );

      console.log(`[DEBUG] 레이어 가시성 업데이트: ${layerType}, 줌 레벨 = ${currentZoom}, 목표 = ${shouldBeVisible}`);
      
      const visibilityKey = layerInfo.overlayVisibleKey;
      const currentVisibility = section.overlayVisibles[visibilityKey];
      
      // 가시성 상태 변경이 필요한 경우만 업데이트
      if (currentVisibility !== shouldBeVisible) {
        // 현재 상태가 목표 상태와 다를 경우만 토글
        console.log(`[DEBUG] 레이어 가시성 토글 시작: ${layerType} (섹션: ${this._activeSection})`);
        this._toggleLayerVisibility(this._activeSection, layerType);
        
        // 상태 직접 업데이트 (toggleLayerVisibility에서 변경된 상태가 유지되지 않으므로 여기서 직접 설정)
        section.overlayVisibles[visibilityKey] = shouldBeVisible;
        
        console.log(`[DEBUG] 레이어 가시성 변경: ${layerType} -> ${shouldBeVisible ? '표시' : '숨김'}, overlayVisibles[${visibilityKey}]=${section.overlayVisibles[visibilityKey]}`);
      } else {
        console.log(`[DEBUG] 레이어 가시성 변경 불필요: ${layerType}는 이미 ${shouldBeVisible ? '표시' : '숨김'} 상태임`);
      }
    });
    
    // 가시성 변경 여부 확인
    const hasChanges = JSON.stringify(prevVisibilityState) !== JSON.stringify(section.overlayVisibles);
    
    // 변경 후 상태 로그
    console.log('[DEBUG] 업데이트 후 overlayVisibles 상태:', JSON.stringify(section.overlayVisibles));
    console.log(`[DEBUG] 가시성 상태 변경 여부: ${hasChanges ? '변경됨' : '변경 없음'}`);
    
    // 각 레이어별 가시성 상태와 아이템 개수 로그
    const visibleItemCounts = {
      shopsMarker: section.shops?.markers?.filter(m => m.getVisible && m.getVisible()).length || 0,
      shopsPolygon: section.shops?.polygons?.filter(p => p.getVisible && p.getVisible()).length || 0,
      landmarksMarker: section.landmarks?.imageMarkers?.filter(m => m.getVisible && m.getVisible()).length || 0,
      hotspotsMarker: section.hotspots?.imageMarkers?.filter(m => m.getVisible && m.getVisible()).length || 0
    };
    
    console.log('[DEBUG] 가시 상태 아이템 개수:', JSON.stringify(visibleItemCounts));
    
    console.log('[DEBUG] 줌 레벨에 따른 가시성 업데이트 완료');
  },
};

export default MapOverlayManager; 