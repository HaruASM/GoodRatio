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
 * 3. _overlaysBySections 구조 내의 각 섹션별 overlayLayerVisibles 객체의 상태값을 
 *    이 규칙에 따라 업데이트합니다.
 * 
 * 4. 레이어별 일괄 처리: 개별 오버레이에 접근하지 않고, 레이어 단위로 모든 오버레이의 
 *    가시성을 일괄적으로 업데이트하여 처리 효율성을 향상시킵니다.
 * 
 * 5. 객체 자체 토글 활용: 각 오버레이 객체는 OverlayDelegate로 래핑되어 동일한 인터페이스의 
 *    toggleVisible() 함수를 통해 가시성을 제어합니다.
 * 
 * === OverlayDelegate 패턴 ===
 * 
 * 서로 다른 오버레이 객체 타입(마커, 폴리곤, 이미지마커)에 대해 통일된 인터페이스를 제공하기 위해
 * OverlayDelegate 객체를 사용합니다:
 * 
 * 1. 각 오버레이 객체는 해당 타입에 맞는 OverlayDelegate 인스턴스로 래핑됩니다.
 * 2. OverlayDelegate는 다음 통일된 인터페이스를 제공합니다:
 *    - toggleVisible(): 오버레이 가시성 토글
 *    - setMap(map): 오버레이를 맵에 추가
 *    - relieveMap(): 오버레이를 맵에서 제거
 * 3. 메타데이터는 OverlayDelegate의 직접 접근 가능한 속성으로 저장됩니다:
 *    - itemId: 아이템 식별자
 *    - sectionName: 섹션 이름
 *    - layerType: 레이어 타입 (SHOPS_MARKER 등)
 *    - category: 카테고리 (shops, landmarks 등)
 *    - name: 아이템 이름
 * 
 * === 오버레이 가시성 토글 구현 ===
 * 
 * 1. 각 오버레이 객체는 OverlayDelegate를 통해 토글 함수 제공:
 *    - 객체 타입에 따른 서로 다른 가시성 제어 메소드가 통일된 인터페이스로 추상화됨
 *    - 각 델리게이트는 내부에 실제 오버레이 객체 참조를 유지
 * 
 * 2. 델리게이트 내부의 오버레이 타입별 처리:
 *    - 마커(AdvancedMarkerElement): style.display로 가시성 제어
 *    - 폴리곤(Polygon): setVisible() 메서드로 가시성 제어
 *    - 이미지마커(AdvancedMarkerElement): style.display로 가시성 제어
 * 
 * === 레이어 타입별 객체 형태 ===
 * 
 * 1. 상점 마커(SHOPS_MARKER): OverlayDelegate
 *    - 내부 오버레이: google.maps.marker.AdvancedMarkerElement
 *    - PinElement 기반, style.display로 가시성 제어
 * 
 * 2. 상점 폴리곤(SHOPS_POLYGON): OverlayDelegate
 *    - 내부 오버레이: google.maps.Polygon
 *    - 좌표 배열 기반, setVisible()로 가시성 제어
 * 
 * 3. 랜드마크 마커(LANDMARKS_MARKER): OverlayDelegate
 *    - 내부 오버레이: google.maps.marker.AdvancedMarkerElement
 *    - 이미지 요소 기반, style.display로 가시성 제어
 * 
 * 4. 핫스팟 마커(HOTSPOTS_MARKER): OverlayDelegate
 *    - 내부 오버레이: google.maps.marker.AdvancedMarkerElement
 *    - 커스텀 스타일 마커, style.display로 가시성 제어
 * 
 * === 레이어별 오버레이 객체 세부 설명 ===
 * 
 * 1. 상점 마커 (SHOPS_MARKER)
 *    - 객체 타입: OverlayDelegate (내부: google.maps.marker.AdvancedMarkerElement)
 *    - 데이터 위치: _overlaysBySections[섹션명].shops.markers[]
 *    - 가시성 관리: 델리게이트의 toggleVisible() 메소드로 제어
 *    - 메타데이터: itemId, category, sectionName 등을 직접 속성으로 접근
 *    - 줌 범위: MIN_ZOOM=15, MAX_ZOOM=17
 * 
 * 2. 상점 폴리곤 (SHOPS_POLYGON)
 *    - 객체 타입: OverlayDelegate (내부: google.maps.Polygon)
 *    - 데이터 위치: _overlaysBySections[섹션명].shops.polygons[]
 *    - 가시성 관리: 델리게이트의 toggleVisible() 메소드로 제어
 *    - 메타데이터: itemId, category, sectionName 등을 직접 속성으로 접근
 *    - 줌 범위: MIN_ZOOM=16, MAX_ZOOM=20
 * 
 * 3. 랜드마크 이미지 마커 (LANDMARKS_MARKER)
 *    - 객체 타입: OverlayDelegate (내부: google.maps.marker.AdvancedMarkerElement)
 *    - 데이터 위치: _overlaysBySections[섹션명].landmarks.imageMarkers[]
 *    - 가시성 관리: 델리게이트의 toggleVisible() 메소드로 제어
 *    - 메타데이터: itemId, category, sectionName 등을 직접 속성으로 접근
 *    - 이미지 활용: 랜드마크 이미지를 표시
 *    - 줌 범위: MIN_ZOOM=10, MAX_ZOOM=19
 * 
 * 4. 핫스팟 이미지 마커 (HOTSPOTS_MARKER)
 *    - 객체 타입: OverlayDelegate (내부: google.maps.marker.AdvancedMarkerElement)
 *    - 데이터 위치: _overlaysBySections[섹션명].hotspots.imageMarkers[]
 *    - 가시성 관리: 델리게이트의 toggleVisible() 메소드로 제어
 *    - 메타데이터: itemId, category, sectionName 등을 직접 속성으로 접근
 *    - 이미지 활용: 핫스팟 아이콘을 표시
 *    - 줌 범위: MIN_ZOOM=10, MAX_ZOOM=16
 *
 * === LAYER_CONSTANTS 활용 방법 ===
 *
 * LAYER_CONSTANTS는 각 레이어 타입에 대한 정보를 담고 있는 상수 객체입니다:
 *
 * 1. 레이어 정보 구조:
 *    - name: 레이어 이름 (예: 'SHOPS_MARKER')
 *    - MIN_ZOOM/MAX_ZOOM: 레이어가 표시되는 줌 레벨 범위
 *    - section: _overlaysBySections 내에서 데이터가 저장된 섹션 키 (예: 'shops')
 *    - collection: 섹션 내에서 데이터가 저장된 컬렉션 키 (예: 'markers')
 *    - overlayVisibleKey: overlayLayerVisibles 객체 내 사용되는 키 (예: 'shopsMarker')
 *
 * 2. 활용 예시:
 *    - 레이어 접근: _overlaysBySections[sectionName][LAYER_CONSTANTS.SHOPS_MARKER.section][LAYER_CONSTANTS.SHOPS_MARKER.collection]
 *    - 가시성 확인: section.overlayLayerVisibles[LAYER_CONSTANTS.SHOPS_MARKER.overlayVisibleKey]
 *    - 줌 레벨 확인: currentZoom >= LAYER_CONSTANTS.SHOPS_MARKER.MIN_ZOOM && currentZoom <= LAYER_CONSTANTS.SHOPS_MARKER.MAX_ZOOM
 *
 * 3. 유틸리티 함수:
 *    - _getLayerOverlays(sectionName, layerType): 레이어 타입에 해당하는 오버레이 배열 가져오기
 *    - _toggleLayerVisibility(sectionName, layerType): 레이어 가시성 토글
 *    - _updateVisibilityForZoom(): 현재 줌 레벨에 따라 모든 레이어 가시성 업데이트
 * 
 * === 목표 명세 ===
 * 
 * 1. 데이터 구조:
 *    _overlaysBySections = {
 *      [섹션명]: {
 *        overlayLayerVisibles: {
 *          shopsMarker: boolean,
 *          shopsPolygon: boolean,
 *          landmarksMarker: boolean,
 *          hotspotsMarker: boolean
 *        },
 *        shops: {
 *          markers: [OverlayDelegate, OverlayDelegate, ...],
 *          polygons: [OverlayDelegate, OverlayDelegate, ...]
 *        },
 *        landmarks: {
 *          imageMarkers: [OverlayDelegate, OverlayDelegate, ...]
 *        },
 *        hotspots: {
 *          imageMarkers: [OverlayDelegate, OverlayDelegate, ...]
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
 *    - registerOverlaysByItemlist(): 아이템 리스트로 오버레이 등록 및 OverlayDelegate 객체 생성
 *    - changeSection(): 활성 섹션 변경
 *    - _updateVisibilityForZoom(): 줌 레벨에 따른 overlayLayerVisibles 상태 업데이트
 *    - _toggleLayerVisibility(): overlayLayerVisibles 상태 변경 시 레이어별 오버레이 일괄 토글
 * 
 * 5. 토글 기능 작동 방식:
 *    - overlayLayerVisibles 상태가 변경될 때만 해당 레이어의 오버레이들을 일괄 토글
 *    - 각 OverlayDelegate 객체는 toggleVisible() 메소드를 통해 내부 오버레이 객체의 가시성 제어
 *    - 모든 오버레이 타입에 대해 동일한 인터페이스로 접근 가능
 */

import OverlayService from './OverlayService';
import { ICON_TYPES } from './MapIcons';

/**
 * 오버레이 레이어 상수 정의
 */
const LAYER_CONSTANTS = {
  SHOPS_MARKER: { 
    name: 'SHOPS_MARKER',
    MIN_ZOOM: 15,
    MAX_ZOOM: 17,
    section: 'shops',           // 데이터가 저장된 섹션 키
    collection: 'markers',      // 컬렉션 키
    overlayVisibleKey: 'shopsMarker' // overlayLayerVisibles의 키
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
    MIN_ZOOM: 10,
    MAX_ZOOM: 16,
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
    // TODO 활성섹션과 DB섹션 관리에 대한 추가 필요
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

    // 대구 동성로 좌표에 스트리트 뷰 이미지 마커 추가 (35.863921, 128.600704)
    try {
      // 대구 동성로 위치 (지정된 좌표)
      const streetViewPosition = new google.maps.LatLng(35.863921 - 0.003, 128.600704 + 0.001);
      
      // 스트리트 뷰 이미지 마커 생성
      this._addStreetViewMarker(streetViewPosition);

    } catch (error) {
      console.error('[ERROR] 스트리트 뷰 마커 생성 실패:', error.message);
    }

    // 테스트용 그라운드오버레이 추가
    try {
      // 직접 접근 가능한 이미지 URL (Unsplash에서 제공하는 이미지)
      const imageUrl = "https://images.unsplash.com/photo-1500534623283-312aade485b7?q=80&w=1000&auto=format&fit=crop";
      
      // 맵 중심 위치 가져오기
      const mapCenter = this._mapInstance.getCenter();
      
      // LatLng 객체에서 좌표값 추출 (함수로 호출해야 함)
      const centerLat = mapCenter.lat();
      const centerLng = mapCenter.lng();
      
      // 그라운드오버레이 영역 설정 (크기를 반으로 줄이고 좌측으로 이동)
      const imageBounds = {
        north: centerLat + 0.0004,                // 세로 크기 반으로 줄임
        south: centerLat - 0.0005,                // 세로 크기 반으로 줄임
        east: centerLng - 0.0012,                  // 좌측으로 이동
        west: centerLng - 0.0012 - 0.0005          // 좌측으로 이동 및 가로 크기 반으로 줄임
      };

      // 그라운드오버레이 생성
      const groundOverlay = new google.maps.GroundOverlay(
        imageUrl,
        imageBounds
      );
      
      // 그라운드오버레이를 맵에 표시
      groundOverlay.setMap(this._mapInstance);
      
      // 디버깅 메시지 추가
      console.log('[DEBUG] 테스트용 그라운드오버레이 생성 완료');
      console.log(`[DEBUG] 그라운드오버레이 영역: 북=${imageBounds.north}, 남=${imageBounds.south}, 동=${imageBounds.east}, 서=${imageBounds.west}`);
      
      // 나중에 참조할 수 있도록 그라운드오버레이 저장
      this._testGroundOverlay = groundOverlay;
      
      // 도시 거리 풍경 이미지를 사용한 AdvancedMarker 추가
      this._addCityStreetMarker(centerLat, centerLng);
      
    } catch (error) {
      console.error('[ERROR] 테스트용 그라운드오버레이 생성 실패:', error.message);
    }

    // 구글 예제의 보라색 원형 SVG 아이콘 샘플 추가
    try {
      // 구글 예제의 보라색 원형 SVG 문자열
      const pinSvgString =
        '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none"><rect width="56" height="56" rx="28" fill="#7837FF"></rect><path d="M46.0675 22.1319L44.0601 22.7843" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M11.9402 33.2201L9.93262 33.8723" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M27.9999 47.0046V44.8933" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M27.9999 9V11.1113" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M39.1583 43.3597L37.9186 41.6532" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M16.8419 12.6442L18.0816 14.3506" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9.93262 22.1319L11.9402 22.7843" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M46.0676 33.8724L44.0601 33.2201" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M39.1583 12.6442L37.9186 14.3506" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M16.8419 43.3597L18.0816 41.6532" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M28 39L26.8725 37.9904C24.9292 36.226 23.325 34.7026 22.06 33.4202C20.795 32.1378 19.7867 30.9918 19.035 29.9823C18.2833 28.9727 17.7562 28.0587 17.4537 27.2401C17.1512 26.4216 17 25.5939 17 24.7572C17 23.1201 17.5546 21.7513 18.6638 20.6508C19.7729 19.5502 21.1433 19 22.775 19C23.82 19 24.7871 19.2456 25.6762 19.7367C26.5654 20.2278 27.34 20.9372 28 21.8649C28.77 20.8827 29.5858 20.1596 30.4475 19.6958C31.3092 19.2319 32.235 19 33.225 19C34.8567 19 36.2271 19.5502 37.3362 20.6508C38.4454 21.7513 39 23.1201 39 24.7572C39 25.5939 38.8488 26.4216 38.5463 27.2401C38.2438 28.0587 37.7167 28.9727 36.965 29.9823C36.2133 30.9918 35.205 32.1378 33.94 33.4202C32.675 34.7026 31.0708 36.226 29.1275 37.9904L28 39Z" fill="#FF7878"></path></svg>';
      
      // 맵 중심 위치에서 약간 오른쪽으로 이동한 위치 계산 (svgMarkerPosition.lng()는 함수 호출임)
      const svgMarkerPosition = this._mapInstance.getCenter();
      const markerLng = svgMarkerPosition.lng() - 0.004; // 서쪽으로 이동 (기존 +0.002에서 -0.004로 변경)
      
      // 새 LatLng 객체 생성 (수정된 좌표로)
      const markerPosition = new google.maps.LatLng(
        svgMarkerPosition.lat() - 0.003, // 남쪽으로 이동
        markerLng - 0.004 // 서쪽으로 이동
      );
      
      // AdvancedMarkerElement 지원 확인
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        // SVG 문자열을 DOM 요소로 변환
        const parser = new DOMParser();
        const pinSvg = parser.parseFromString(pinSvgString, "image/svg+xml").documentElement;
        
        // 마커 스타일 설정
        pinSvg.style.cursor = 'pointer';
        pinSvg.style.width = '56px';
        pinSvg.style.height = '56px';
        
        // AdvancedMarkerElement 생성
        const pinSvgMarkerView = new google.maps.marker.AdvancedMarkerElement({
          map: this._mapInstance,
          position: markerPosition,
          content: pinSvg,
          title: "구글 예제의 보라색 원형 SVG 아이콘"
        });
        
        console.log('[DEBUG] 보라색 원형 SVG 아이콘 샘플 마커 생성 완료');
      } else {
        // 기존 마커 API로 대체 (SVG를 지원하지 않는 환경용)
        console.warn('[WARN] AdvancedMarkerElement를 지원하지 않아 기본 마커로 대체합니다.');
        
        // 일반 마커 생성
        const fallbackMarker = new google.maps.Marker({
          position: markerPosition,
          map: this._mapInstance,
          title: '보라색 원형 SVG 아이콘 (대체 마커)'
        });
      }
    } catch (error) {
      console.error('[ERROR] 보라색 원형 SVG 아이콘 샘플 생성 실패:', error.message);
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
    
    // 가시성 상태가 true인 레이어만 토글
    Object.entries(LAYER_CONSTANTS).forEach(([layerType, layerInfo]) => {
      const visibilityKey = layerInfo.overlayVisibleKey;
      if (section.overlayLayerVisibles[visibilityKey]) {
        // 레이어가 현재 표시 중인 경우 숨김 처리
        this._toggleLayerVisibility(sectionName, layerType);
        section.overlayLayerVisibles[visibilityKey] = false;
      }
    });
    
    console.log(`[DEBUG] 섹션 '${sectionName}'의 모든 오버레이 숨기기 완료`);
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
      
      // 두 번째 마커 줌 이벤트 리스너 제거
      if (this._zoomMarkerListener) {
        google.maps.event.removeListener(this._zoomMarkerListener);
        this._zoomMarkerListener = null;
      }
    }
    
    // 모든 섹션의 오버레이 정리
    Object.keys(this._overlaysBySections).forEach(sectionName => {
      this._hideAllOverlaysInSection(sectionName);
      
      // 맵에서 오버레이 제거 - OverlayDelegate 객체 기반으로 수정
      const section = this._overlaysBySections[sectionName];
      
      // 상점 마커 제거
      if (section.shops && Array.isArray(section.shops.markers)) {
        section.shops.markers.forEach(delegate => {
          delegate.relieveMap();
        });
        section.shops.markers = [];
      }
      
      // 상점 폴리곤 제거
      if (section.shops && Array.isArray(section.shops.polygons)) {
        section.shops.polygons.forEach(delegate => {
          delegate.relieveMap();
        });
        section.shops.polygons = [];
      }
      
      // 랜드마크 제거
      if (section.landmarks && Array.isArray(section.landmarks.imageMarkers)) {
        section.landmarks.imageMarkers.forEach(delegate => {
          delegate.relieveMap();
        });
        section.landmarks.imageMarkers = [];
      }
      
      // 핫스팟 제거
      if (section.hotspots && Array.isArray(section.hotspots.imageMarkers)) {
        section.hotspots.imageMarkers.forEach(delegate => {
          delegate.relieveMap();
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
   * 아이템 리스트로 오버레이 일괄 등록
   * @param {string} sectionName - 섹션 이름
   * @param {Array} itemList - 등록할 아이템 리스트
   * @returns {boolean} 등록 성공 여부
   */
  registerOverlaysByItemlist: function(sectionName, itemList) {
    console.log(`[DEBUG] 오버레이 일괄 등록 시작: ${sectionName}, 항목 ${itemList?.length || 0}개`);
    
    if (!itemList || !Array.isArray(itemList) || itemList.length === 0) {
      console.error('[ERROR] 유효한 아이템 리스트가 제공되지 않았습니다.');
      return false;
    }
    
    if (!sectionName) {
      console.error('[ERROR] 섹션 이름이 제공되지 않았습니다.');
      return false;
    }
    
    // 섹션이 존재하지 않으면 생성
    if (!this._overlaysBySections[sectionName]) {
      this._overlaysBySections[sectionName] = {
        overlayLayerVisibles: {
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
    
    // 각 카테고리별 오버레이 등록 결과 카운트
    let results = {
      shops: { markers: 0, polygons: 0 },
      landmarks: { imageMarkers: 0 },
      hotspots: { imageMarkers: 0 }
    };
    
    // 모든 아이템을 카테고리 필드에 따라 분류하여 처리
    for (const item of itemList) {
      // 카테고리가 없으면 기본값 'shops' 사용
      if (!item.category) {
        console.error(`[WARN] 아이템 ID: ${item.id}에 카테고리가 없습니다`);
        return false;
      }

      const category = item.category;
      

      //TODO 개발중 카테고리는 추가가 계속 될것이므로, 사용하지 않더라도 생성 함수를 남겨둘것. 
      switch (category) {
        case 'shops': // Constants.SHOPS_MARKER와 Constants.SHOPS_POLYGON 두 가지 레이어 생성
        // 상점 마커 생성 및 등록
        if (item.pinCoordinates) {
          const marker = OverlayService.createOverlayOfShopMarker(this._mapInstance, item, sectionName);
          if (marker) {
            section.shops.markers.push(marker);
            results.shops.markers++;
          }
        }
        
        // 상점 폴리곤 생성 및 등록
        if (item.path?.length >= 3) {
          const polygon = OverlayService.createOverlayOfShopPolygon(this._mapInstance, item, sectionName);
          if (polygon) {
            section.shops.polygons.push(polygon);
            results.shops.polygons++;
          }
        }
          break;
        case 'landmarks': // Constants.LANDMARKS_MARKER 레이어 생성
        if (item.pinCoordinates) {
          const imageMarker = OverlayService.createOverlayOfLandmarkMarker(this._mapInstance, item, sectionName);
          if (imageMarker) {
            section.landmarks.imageMarkers.push(imageMarker);
            results.landmarks.imageMarkers++;
          }
        }
          break;
        case 'hotspots': // Constants.HOTSPOTS_MARKER 레이어 생성
        if (item.pinCoordinates) {
          const imageMarker = OverlayService.createOverlayOfHotspotMarker(this._mapInstance, item, sectionName);
          if (imageMarker) {
            section.hotspots.imageMarkers.push(imageMarker);
            results.hotspots.imageMarkers++;
          }
        }
          break;
      }
    }
    
    // 현재 활성 섹션 & 줌 레벨에 따라 가시성 업데이트 // 생성한 오버레이 레이어의 sectionNAme이 activeSEction이면 가시성 업데이트. 생성된 오버레이의 가시성 디폴트는 가시성 비활성.
    if (this._activeSection === sectionName) {
      console.log(`[DEBUG] 현재 활성 섹션(${sectionName})의 오버레이 가시성 업데이트`);
      this._updateVisibilityForZoom();
    }
    
    console.log(`[DEBUG] 오버레이 일괄 등록 완료: ${sectionName}`);
    console.log(`  - 상점 마커: ${section.shops.markers.length}개`);
    console.log(`  - 상점 폴리곤: ${section.shops.polygons.length}개`);
    console.log(`  - 랜드마크 마커: ${section.landmarks.imageMarkers.length}개`);
    console.log(`  - 핫스팟 마커: ${section.hotspots.imageMarkers.length}개`);
    
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
    const currentVisibility = section.overlayLayerVisibles[overlayVisibleKey];
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
      // OverlayDelegate 객체의 toggleVisible 메소드 호출
        try {
            overlay.toggleVisible();
            successCount++;
          
          // 첫 번째 오버레이의 상태 로깅 (디버깅용)
          if (index === 0) {
          console.log(`[DEBUG] 첫 번째 오버레이 ID: ${overlay.itemId || 'unknown'}`);
          }
        } catch (error) {
          console.error(`[ERROR] 오버레이 토글 중 오류 발생: ${error.message}`);
        failCount++;
      }
    });
    
    // 레이어 상태 업데이트
    section.overlayLayerVisibles[overlayVisibleKey] = targetVisibility;
    
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
    console.log('[DEBUG] 업데이트 전 overlayLayerVisibles 상태:', JSON.stringify(section.overlayLayerVisibles));
    
    // 이전 가시성 상태 저장 (변경 여부 확인용)
    const prevVisibilityState = JSON.parse(JSON.stringify(section.overlayLayerVisibles));
    
    // 각 레이어의 가시성 업데이트
    Object.entries(LAYER_CONSTANTS).forEach(([layerType, layerInfo]) => {
      const shouldBeVisible = (
        currentZoom >= layerInfo.MIN_ZOOM && 
        currentZoom <= layerInfo.MAX_ZOOM
      );

      console.log(`[DEBUG] 레이어 가시성 업데이트: ${layerType}, 줌 레벨 = ${currentZoom}, 목표 = ${shouldBeVisible}`);
      
      const visibilityKey = layerInfo.overlayVisibleKey;
      const currentVisibility = section.overlayLayerVisibles[visibilityKey];
      
      // 가시성 상태 변경이 필요한 경우만 업데이트
      if (currentVisibility !== shouldBeVisible) {
        // 현재 상태가 목표 상태와 다를 경우만 토글
        console.log(`[DEBUG] 레이어 가시성 토글 시작: ${layerType} (섹션: ${this._activeSection})`);
        this._toggleLayerVisibility(this._activeSection, layerType);
        
        // 상태 직접 업데이트 (toggleLayerVisibility에서 변경된 상태가 유지되지 않으므로 여기서 직접 설정)
        section.overlayLayerVisibles[visibilityKey] = shouldBeVisible;
        
        console.log(`[DEBUG] 레이어 가시성 변경: ${layerType} -> ${shouldBeVisible ? '표시' : '숨김'}, overlayLayerVisibles[${visibilityKey}]=${section.overlayLayerVisibles[visibilityKey]}`);
      } else {
        console.log(`[DEBUG] 레이어 가시성 변경 불필요: ${layerType}는 이미 ${shouldBeVisible ? '표시' : '숨김'} 상태임`);
      }
    });
    
    // 가시성 변경 여부 확인
    const hasChanges = JSON.stringify(prevVisibilityState) !== JSON.stringify(section.overlayLayerVisibles);
    
    // 변경 후 상태 로그
    console.log('[DEBUG] 업데이트 후 overlayLayerVisibles 상태:', JSON.stringify(section.overlayLayerVisibles));
    console.log(`[DEBUG] 가시성 상태 변경 여부: ${hasChanges ? '변경됨' : '변경 없음'}`);
    
    // 각 레이어별 가시성 상태와 아이템 개수 로그
    const visibleItemCounts = {
      shopsMarker: section.overlayLayerVisibles.shopsMarker ? (section.shops?.markers?.length || 0) : 0,
      shopsPolygon: section.overlayLayerVisibles.shopsPolygon ? (section.shops?.polygons?.length || 0) : 0,
      landmarksMarker: section.overlayLayerVisibles.landmarksMarker ? (section.landmarks?.imageMarkers?.length || 0) : 0,
      hotspotsMarker: section.overlayLayerVisibles.hotspotsMarker ? (section.hotspots?.imageMarkers?.length || 0) : 0
    };
    
    console.log('[DEBUG] 가시 상태 아이템 개수:', JSON.stringify(visibleItemCounts));
    
    console.log('[DEBUG] 줌 레벨에 따른 가시성 업데이트 완료');
  },
  
  /**
   * 도시 거리 풍경 이미지를 사용한 마커 추가
   * @param {number} lat - 위도
   * @param {number} lng - 경도
   * @private
   */
  _addCityStreetMarker: function(lat, lng) {
    try {
      // 도시 거리 풍경 이미지 URL (Unsplash에서 제공)
      const cityStreetImageUrl = "https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?q=80&w=600&auto=format&fit=crop";
      
      // 마커 위치 (지도 중심에서 약간 우측 및 남쪽으로 이동)
      const markerPosition = new google.maps.LatLng(
        lat - 0.001, // 기존 마커를 남쪽으로 이동
        lng + 0.003
      );
      
      // 두 번째 마커 위치 (첫 번째 마커보다 더 남쪽)
      const secondMarkerPosition = new google.maps.LatLng(
        lat - 0.005, // 더 남쪽으로 이동 (기존 -0.003에서 -0.005로 변경)
        lng + 0.003
      );
      
      // AdvancedMarkerElement 지원 확인
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        // 첫 번째 마커 생성
        const markerContainer = this._createCityStreetMarkerElement(cityStreetImageUrl, "도시 거리 풍경");
        
        const cityStreetMarker = new google.maps.marker.AdvancedMarkerElement({
          map: this._mapInstance,
          position: markerPosition,
          content: markerContainer,
          title: "도시 거리 풍경 마커"
        });
        
        // 마커 클릭 이벤트 처리
        cityStreetMarker.addListener('gmp-click', () => {
          console.log('[DEBUG] 도시 거리 풍경 마커가 클릭되었습니다.');
        });
        
        console.log('[DEBUG] 도시 거리 풍경 마커 생성 완료');
        
        // 나중에 참조할 수 있도록 저장
        this._cityStreetMarker = cityStreetMarker;
        
        // 두 번째 마커 생성 (동일한 디자인)
        const secondMarkerContainer = this._createCityStreetMarkerElement(cityStreetImageUrl, "두 번째 도시 거리");
        
        const secondCityStreetMarker = new google.maps.marker.AdvancedMarkerElement({
          map: this._mapInstance,
          position: secondMarkerPosition,
          content: secondMarkerContainer,
          title: "두 번째 도시 거리 마커"
        });
        
        // Google Place ID
        const placeId = "ChIJo8GLBcTjZTURSudxjOtURAg";
        
        // Place 정보를 담을 인포윈도우 생성
        const placeInfoWindow = new google.maps.InfoWindow({
          content: `<div style="max-width:450px; padding:10px;">
                      <h3 style="margin-top:0; color:#1a73e8; font-size:16px;">대구 동성로 (Dongseongno)</h3>
                      <p style="margin:5px 0; font-size:13px;"><strong>좌표:</strong> 35.867922, 128.603663</p>
                      
                      <!-- 구글 맵스 임베드 - 장소 정보 -->
                      <iframe 
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3232.7760442503547!2d128.60109217680165!3d35.86792207246083!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3565e16ac531c7e3%3A0x3c88c895e73f824c!2z64-Z7ISx66Gc!5e0!3m2!1sko!2skr!4v1721318209766!5m2!1sko!2skr" 
                        width="400" 
                        height="300" 
                        style="border:0; display:block; margin:8px 0;" 
                        allowfullscreen="" 
                        loading="lazy" 
                        referrerpolicy="no-referrer-when-downgrade">
                      </iframe>
                      
                      <!-- 구글 리뷰 위젯 - 이 부분은 Google Business Profile에서 제공하는 실제 코드로 대체해야 합니다 -->
                      <div style="margin:10px 0;">
                        <a href="https://search.google.com/local/writereview?placeid=ChIJ3eG5HqfjZTURSKsx95yYIq0" target="_blank" style="display:inline-block; padding:8px 12px; background-color:#1a73e8; color:white; text-decoration:none; border-radius:4px; margin-bottom:10px; font-size:14px;">리뷰 쓰기</a>
                        
                        <p style="margin:5px 0; font-size:13px;">
                          <strong>참고: </strong>Google은 사이트에 직접 리뷰를 임베드하는 방식을 제한하고 있습니다. 비즈니스 소유자인 경우, Google Business Profile에서 리뷰 위젯 코드를 생성할 수 있습니다.
                        </p>
                      </div>
                      
                      <!-- 구글 Place 페이지로 이동하는 링크 -->
                      <div style="font-size:12px; margin-top:8px;">
                        <a href="https://www.google.com/maps/place/%EB%8F%99%EC%84%B1%EB%A1%9C/@35.8679221,128.6010922,17z/data=!3m1!4b1!4m6!3m5!1s0x3565e16ac531c7e3:0x3c88c895e73f824c!8m2!3d35.8679221!4d128.6036671!16s%2Fm%2F027118j?entry=ttu" 
                           target="_blank" 
                           style="color:#1a73e8; text-decoration:none; display:block; text-align:center; padding:8px; border:1px solid #e0e0e0; border-radius:4px;">
                          <strong>구글 지도에서 리뷰 및 사진 모두 보기</strong>
                        </a>
                      </div>
                    </div>`,
          pixelOffset: new google.maps.Size(0, -30),
          maxWidth: 450
        });
        
        // 두 번째 마커 클릭 이벤트 처리
        secondCityStreetMarker.addListener('gmp-click', () => {
          console.log('[DEBUG] 두 번째 도시 거리 마커가 클릭되었습니다.');
          placeInfoWindow.open(this._mapInstance, secondCityStreetMarker);
        });
        
        // 마커 마우스 오버/아웃 이벤트 추가
        secondMarkerContainer.addEventListener('mouseenter', () => {
          console.log('[DEBUG] 두 번째 마커 마우스 오버');
          placeInfoWindow.open(this._mapInstance, secondCityStreetMarker);
        });
        
        secondMarkerContainer.addEventListener('mouseleave', () => {
          console.log('[DEBUG] 두 번째 마커 마우스 아웃');
          // 약간의 지연을 두어 인포윈도우로 마우스가 이동할 시간을 줌
          setTimeout(() => {
            if (!this._isMouseOverPlaceInfoWindow) {
              placeInfoWindow.close();
            }
          }, 100);
        });
        
        // 인포윈도우에 마우스 오버/아웃 이벤트 추가
        this._isMouseOverPlaceInfoWindow = false;
        
        google.maps.event.addListener(placeInfoWindow, 'domready', () => {
          const infoWindowContent = document.querySelector('.gm-style-iw-a');
          if (infoWindowContent) {
            infoWindowContent.addEventListener('mouseenter', () => {
              this._isMouseOverPlaceInfoWindow = true;
            });
            
            infoWindowContent.addEventListener('mouseleave', () => {
              this._isMouseOverPlaceInfoWindow = false;
              placeInfoWindow.close();
            });
          }
        });
        
        // 나중에 참조할 수 있도록 저장
        this._secondCityStreetMarker = secondCityStreetMarker;
        this._placeInfoWindow = placeInfoWindow;
        
        // 기준 크기 설정 (줌 레벨 17에서의 기본 크기)
        const baseZoom = 17;
        const baseWidth = 120;
        const baseHeight = 80;
        
        // 줌 변경 이벤트에 따른 마커 크기 조절 (별도의 이벤트 리스너 사용)
        const zoomChangeListener = google.maps.event.addListener(
          this._mapInstance,
          'zoom_changed',
          () => {
            const currentZoom = this._mapInstance.getZoom();
            console.log(`[DEBUG] 두 번째 마커 줌 레벨 변경: ${currentZoom}`);
            
            // 줌 레벨에 따른 크기 조정 계산
            // 줌이 커질수록(확대) 마커도 커지도록 계산
            const scaleFactor = Math.pow(1.2, currentZoom - baseZoom); // 1.2의 지수승으로 크기 변화
            
            // 새 크기 계산
            const newWidth = Math.round(baseWidth * scaleFactor);
            const newHeight = Math.round(baseHeight * scaleFactor);
            
            // 최소/최대 크기 제한
            const minSize = 60;  // 최소 크기
            const maxSize = 300; // 최대 크기
            const limitedWidth = Math.max(minSize, Math.min(maxSize, newWidth));
            const limitedHeight = Math.max(minSize, Math.min(maxSize, newHeight));
            
            // 마커 컨테이너 크기 변경
            secondMarkerContainer.style.width = `${limitedWidth}px`;
            secondMarkerContainer.style.height = `${limitedHeight}px`;
            
            // 폰트 크기도 함께 조정
            const baseFontSize = 12;
            const newFontSize = Math.max(8, Math.min(24, Math.round(baseFontSize * scaleFactor)));
            
            // 캡션 요소 찾기 및 폰트 크기 설정
            const captionElement = secondMarkerContainer.querySelector('div');
            if (captionElement) {
              captionElement.style.fontSize = `${newFontSize}px`;
              // 패딩도 조정
              const newPadding = Math.max(4, Math.min(12, Math.round(4 * scaleFactor)));
              captionElement.style.padding = `${newPadding}px ${newPadding * 2}px`;
            }
            
            console.log(`[DEBUG] 두 번째 마커 크기 조정: ${limitedWidth}x${limitedHeight}px (확대비율: ${scaleFactor.toFixed(2)})`);
          }
        );
        
        // 초기 크기 설정을 위해 한 번 실행
        google.maps.event.trigger(this._mapInstance, 'zoom_changed');
        
        console.log('[DEBUG] 두 번째 도시 거리 마커 생성 완료 (줌에 따른 크기 조절 기능 추가)');
        
        // 나중에 참조할 수 있도록 저장
        this._secondCityStreetMarker = secondCityStreetMarker;
        this._zoomMarkerListener = zoomChangeListener; // 이벤트 리스너 참조 저장
      } else {
        // 기존 마커 API로 대체 (Advanced Marker를 지원하지 않는 환경용)
        console.warn('[WARN] AdvancedMarkerElement를 지원하지 않아 기본 마커로 대체합니다.');
        
        // 일반 마커 생성
        const fallbackMarker = new google.maps.Marker({
          position: markerPosition,
          map: this._mapInstance,
          title: '도시 거리 풍경 마커'
        });
        
        // 두 번째 일반 마커 생성
        const secondFallbackMarker = new google.maps.Marker({
          position: secondMarkerPosition,
          map: this._mapInstance,
          title: '두 번째 도시 거리 마커'
        });
      }
    } catch (error) {
      console.error('[ERROR] 도시 거리 풍경 마커 생성 실패:', error.message);
    }
  },
  
  /**
   * 도시 거리 마커 DOM 요소 생성 (재사용 가능한 헬퍼 함수)
   * @param {string} imageUrl - 이미지 URL
   * @param {string} captionText - 캡션 텍스트
   * @returns {HTMLElement} 마커 컨테이너 요소
   * @private
   */
  _createCityStreetMarkerElement: function(imageUrl, captionText) {
    // 마커 컨테이너 생성 (DIV 기반)
    const markerContainer = document.createElement('div');
    markerContainer.className = 'city-street-marker';
    markerContainer.style.position = 'relative';
    markerContainer.style.width = '120px';
    markerContainer.style.height = '80px';
    markerContainer.style.overflow = 'hidden';
    markerContainer.style.borderRadius = '12px';
    markerContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    markerContainer.style.border = '2px solid #ffffff';
    markerContainer.style.cursor = 'pointer';
    
    // 이미지 요소 생성
    const imgElement = document.createElement('img');
    imgElement.src = imageUrl;
    imgElement.style.width = '100%';
    imgElement.style.height = '100%';
    imgElement.style.objectFit = 'cover';
    
    // 이미지 로드 실패 대비 fallback
    imgElement.onerror = () => {
      imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjgwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIGZpbGw9IiNlZWVlZWUiLz48dGV4dCB4PSI2MCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiIGZpbGw9IiM5OTk5OTkiPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
    };
    
    // 캡션 요소 생성
    const captionElement = document.createElement('div');
    captionElement.textContent = captionText;
    captionElement.style.position = 'absolute';
    captionElement.style.bottom = '0';
    captionElement.style.left = '0';
    captionElement.style.right = '0';
    captionElement.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    captionElement.style.color = 'white';
    captionElement.style.padding = '4px 8px';
    captionElement.style.fontSize = '12px';
    captionElement.style.textAlign = 'center';
    captionElement.style.fontWeight = 'bold';
    
    // 컨테이너에 요소 추가
    markerContainer.appendChild(imgElement);
    markerContainer.appendChild(captionElement);
    
    return markerContainer;
  },
  
  /**
   * 스트리트 뷰 이미지 마커 생성
   * @param {google.maps.LatLng} position - 마커 위치
   * @private
   */
  _addStreetViewMarker: function(position) {
    try {
      // AdvancedMarkerElement 지원 확인
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        // 마커 컨테이너 생성 (DIV 기반)
        const markerContainer = document.createElement('div');
        markerContainer.className = 'street-view-marker';
        markerContainer.style.position = 'relative';
        markerContainer.style.width = '150px';
        markerContainer.style.height = '100px';
        markerContainer.style.overflow = 'hidden';
        markerContainer.style.borderRadius = '12px';
        markerContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';
        markerContainer.style.border = '3px solid #ffffff';
        markerContainer.style.cursor = 'pointer';
        
        // 이미지 요소 생성 (스트리트 뷰 정적 이미지)
        const imgElement = document.createElement('img');
        
        // 스트리트 뷰 Static API URL (필리핀 이미지)
        // 주의: 실제 사용 시에는 API 키를 포함해야 하며, 사용량에 따라 요금이 발생할 수 있습니다.
        imgElement.src = "https://images.unsplash.com/photo-1474487548417-781cb71495f3?q=80&w=800&auto=format&fit=crop";
        imgElement.style.width = '100%';
        imgElement.style.height = '100%';
        imgElement.style.objectFit = 'cover';
        
        // 이미지 로드 실패 대비 fallback
        imgElement.onerror = () => {
          console.error('[ERROR] 스트리트 뷰 이미지 로드 실패');
          imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTUwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9Ijc1IiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+U3RyZWV0IFZpZXcgSW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
        };
        
        // Street View 로고 추가
        const logoContainer = document.createElement('div');
        logoContainer.style.position = 'absolute';
        logoContainer.style.top = '8px';
        logoContainer.style.left = '8px';
        logoContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        logoContainer.style.borderRadius = '4px';
        logoContainer.style.padding = '2px 4px';
        
        const logoText = document.createElement('span');
        logoText.textContent = '기차역';
        logoText.style.fontSize = '10px';
        logoText.style.fontWeight = 'bold';
        logoText.style.color = '#4285F4';
        
        logoContainer.appendChild(logoText);
        
        // 캡션 요소 생성
        const captionElement = document.createElement('div');
        captionElement.textContent = '대구 동성로';
        captionElement.style.position = 'absolute';
        captionElement.style.bottom = '0';
        captionElement.style.left = '0';
        captionElement.style.right = '0';
        captionElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        captionElement.style.color = 'white';
        captionElement.style.padding = '6px 8px';
        captionElement.style.fontSize = '12px';
        captionElement.style.textAlign = 'center';
        captionElement.style.fontWeight = 'bold';
        
        // 컨테이너에 요소 추가
        markerContainer.appendChild(imgElement);
        markerContainer.appendChild(logoContainer);
        markerContainer.appendChild(captionElement);
        
        // Street View 마커 생성
        const streetViewMarker = new google.maps.marker.AdvancedMarkerElement({
          map: this._mapInstance,
          position: position,
          content: markerContainer,
          title: "대구 동성로 스트리트 뷰"
        });
        
        // 인포윈도우 생성 (초기에는 숨김 상태)
        const infoWindow = new google.maps.InfoWindow({
          content: `<iframe src="https://www.google.com/maps/embed?pb=!4v1744375904548!6m8!1m7!1sQ2lNKFVPEC4iLyQa2lIeKg!2m2!1d15.16116936014199!2d120.5564981223493!3f104.91061749420984!4f-2.234795058878106!5f0.7820865974627469" width="450" height="350" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                    <div style="text-align:center; margin-top:5px; font-weight:bold;">필리핀 스트리트 뷰 (샘플)</div>`,
          pixelOffset: new google.maps.Size(0, -30)
        });
        
        // 마커 마우스 오버/아웃 이벤트 추가
        markerContainer.addEventListener('mouseenter', () => {
          console.log('[DEBUG] 스트리트 뷰 마커 마우스 오버');
          infoWindow.open(this._mapInstance, streetViewMarker);
        });
        
        markerContainer.addEventListener('mouseleave', () => {
          console.log('[DEBUG] 스트리트 뷰 마커 마우스 아웃');
          // 약간의 지연을 두어 인포윈도우로 마우스가 이동할 시간을 줌
          setTimeout(() => {
            if (!this._isMouseOverInfoWindow) {
              infoWindow.close();
            }
          }, 100);
        });
        
        // 인포윈도우에 마우스 오버/아웃 이벤트 추가
        // 참고: DOM이 생성된 후에만 가능하므로 addListener로 열릴 때 이벤트 추가
        this._isMouseOverInfoWindow = false;
        
        google.maps.event.addListener(infoWindow, 'domready', () => {
          const infoWindowContent = document.querySelector('.gm-style-iw-a');
          if (infoWindowContent) {
            infoWindowContent.addEventListener('mouseenter', () => {
              this._isMouseOverInfoWindow = true;
            });
            
            infoWindowContent.addEventListener('mouseleave', () => {
              this._isMouseOverInfoWindow = false;
              infoWindow.close();
            });
          }
        });
        
        // 마커 클릭 이벤트 처리
        streetViewMarker.addListener('gmp-click', () => {
          console.log('[DEBUG] 스트리트 뷰 마커가 클릭되었습니다.');
          
          // 클릭 시 다른 동작 구현 가능
          // 예: 전체 화면 모달로 스트리트 뷰 표시
        });
        
        // 나중에 참조할 수 있도록 저장
        this._streetViewMarker = streetViewMarker;
        this._streetViewInfoWindow = infoWindow;
        
        console.log('[DEBUG] 스트리트 뷰 마커 생성 완료');
      } else {
        console.warn('[WARN] AdvancedMarkerElement를 지원하지 않아 스트리트 뷰 마커를 생성할 수 없습니다.');
      }
    } catch (error) {
      console.error('[ERROR] 스트리트 뷰 마커 생성 실패:', error.message);
    }
  },
};

export default MapOverlayManager; 