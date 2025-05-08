/**
 * 간소화된 MapOverlayManager 구현
 * 
 * 섹션 및 카테고리별로 오버레이를 관리하고, 객체 직접 탐색을 통해
 * 오버레이 가시성을 효율적으로 관리하는 클래스입니다.
 * 
 * === 아이콘 생성 방식 ===
 * 
 * 1. 아이콘 생성은 MapIcons.js 모듈을 통해 중앙 관리됩니다:
 *    - ICON_DESIGN: 다양한 아이콘 타입을 상수로 정의 (RESTAURANT, CAFE, HOTEL, DEFAULT, HEARTRETRO 등)
 *    - SVG_ICON_DATA: 각 아이콘 타입별 SVG 데이터 저장
 *    - ICON_STYLES: 아이콘 스타일 속성 정의 (배경색, 아이콘 색, 크기, 그림자 등)
 *    - ICON_STYLE_MAPPING: 아이콘 타입과 스타일 매핑
 * 
 * 2. 아이콘 생성 함수:
 *    - createIconSvg(): SVG 아이콘 요소 생성
 *    - createIconByiconDesign(): 아이콘 타입에 따른 마커 컨테이너 생성
 * 
 * 3. 커스텀 아이콘 추가 방법:
 *    - MapIcons.js의 ICON_DESIGN에 새 아이콘 타입 상수 추가
 *    - SVG_ICON_DATA에 해당 아이콘의 SVG 데이터 추가
 *    - ICON_STYLES에 스타일 속성 정의
 *    - ICON_STYLE_MAPPING에 타입-스타일 매핑 추가
 * 
 * 4. 마커 생성 시 사용 예시:
 *    - const { createIconByiconDesign, ICON_DESIGN } = require('./MapIcons');
 *    - const icon = createIconByiconDesign(ICON_DESIGN.HEARTRETRO);
 *    - 생성된 icon 요소를 google.maps.marker.AdvancedMarkerElement의 content로 설정
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
 * 3. 랜드마크 이미지 마커 (LANDMARKS_MARKER): OverlayDelegate
 *    - 객체 타입: OverlayDelegate (내부 오버레이: google.maps.marker.AdvancedMarkerElement)
 *    - 생성 함수: OverlayService.createOverlayOfLandmarkMarker() 비동기 함수 사용
 *    - 이미지 설정: 아이템의 mainImage 속성에서 publicId 사용, 이미지 크기는 고정 (baseWidth=120, baseHeight=80)
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
import { ICON_DESIGN } from './MapIcons';

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
   * @returns {Promise<boolean>} 성공 여부
   */
  changeSection: async function(sectionName) {
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
    
    
    
    // 이전 섹션 숨기기
    if (this._activeSection && this._overlaysBySections[this._activeSection]) {
      this._hideAllOverlaysInSection(this._activeSection);
    }
    
    // 활성 섹션 업데이트
    this._activeSection = sectionName;
    
    // 줌 레벨에 따른 가시성 업데이트 트리거
    await this._updateVisibilityForZoom();
    
    
    
    
    
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
    
    
    
    // 가시성 상태가 true인 레이어만 토글
    Object.entries(LAYER_CONSTANTS).forEach(([layerType, layerInfo]) => {
      const visibilityKey = layerInfo.overlayVisibleKey;
      if (section.overlayLayerVisibles[visibilityKey]) {
        // 레이어가 현재 표시 중인 경우 숨김 처리
        this._toggleLayerVisibility(sectionName, layerType);
        section.overlayLayerVisibles[visibilityKey] = false;
      }
    });
    
    
  },
  
  /**
   * 전체 정리 (컴포넌트 언마운트시 호출)
   */
  cleanup: function() {
    
    
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
    
    
  },
  
  /**
   * 아이템 리스트로 오버레이 일괄 등록
   * @param {string} sectionName - 섹션 이름
   * @param {Array} itemList - 등록할 아이템 리스트
   * @returns {Promise<boolean>} 등록 성공 여부
   */
  registerOverlaysByItemlist: async function(sectionName, itemList) {
    
    
    if (!itemList || !Array.isArray(itemList) || itemList.length === 0) {
      console.error('[ERROR] 유효한 아이템 리스트가 제공되지 않았습니다.');
      return false;
    }
    
    if (!sectionName) {
      console.error('[ERROR] 섹션 이름이 제공되지 않았습니다.');
      return false;
    }
    
    // 섹션이 존재하는 경우 기존 오버레이를 정리하여 중복 등록 방지
    if (this._overlaysBySections[sectionName]) {
      const section = this._overlaysBySections[sectionName];
      
      // 기존에 등록된 오버레이를 정리
      if (section.shops && Array.isArray(section.shops.markers)) {
        section.shops.markers.forEach(delegate => {
          if (delegate && typeof delegate.relieveMap === 'function') {
            delegate.relieveMap();
          }
        });
        section.shops.markers = [];
      }
      
      if (section.shops && Array.isArray(section.shops.polygons)) {
        section.shops.polygons.forEach(delegate => {
          if (delegate && typeof delegate.relieveMap === 'function') {
            delegate.relieveMap();
          }
        });
        section.shops.polygons = [];
      }
      
      if (section.landmarks && Array.isArray(section.landmarks.imageMarkers)) {
        section.landmarks.imageMarkers.forEach(delegate => {
          if (delegate && typeof delegate.relieveMap === 'function') {
            delegate.relieveMap();
          }
        });
        section.landmarks.imageMarkers = [];
      }
      
      if (section.hotspots && Array.isArray(section.hotspots.imageMarkers)) {
        section.hotspots.imageMarkers.forEach(delegate => {
          if (delegate && typeof delegate.relieveMap === 'function') {
            delegate.relieveMap();
          }
        });
        section.hotspots.imageMarkers = [];
      }
      
      
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
    
    const overlayLayersBySection = this._overlaysBySections[sectionName];
    
    // 각 카테고리별 오버레이 등록 결과 카운트
    let results = {
      shops: { markers: 0, polygons: 0 },
      landmarks: { imageMarkers: 0 },
      hotspots: { imageMarkers: 0 }
    };
    
    // 비동기 작업을 위한 프로미스 배열
    const pendingPromises = [];
    
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
            overlayLayersBySection.shops.markers.push(marker);
            results.shops.markers++;
            
            // 현재 레이어의 가시성 상태 확인하고 토글 처리
            const isLayerVisible = overlayLayersBySection.overlayLayerVisibles.shopsMarker;
            if (isLayerVisible) {
              // 레이어가 보이는 상태일 때만 오버레이도 보이게 토글
              marker.toggleVisible();
            }
          }
        }
        
        // 상점 폴리곤 생성 및 등록
        if (item.path?.length >= 3) {
          const polygon = OverlayService.createOverlayOfShopPolygon(this._mapInstance, item, sectionName);
          if (polygon) {
            overlayLayersBySection.shops.polygons.push(polygon);
            results.shops.polygons++;
            
            // 현재 레이어의 가시성 상태 확인하고 토글 처리
            const isLayerVisible = overlayLayersBySection.overlayLayerVisibles.shopsPolygon;
            if (isLayerVisible) {
              // 레이어가 보이는 상태일 때만 오버레이도 보이게 토글
              polygon.toggleVisible();
            }
          }
        }
          break;
        case 'landmarks': // Constants.LANDMARKS_MARKER 레이어 생성
        if (item.pinCoordinates) {
          // 비동기 함수를 Promise 배열에 추가하여 나중에 대기할 수 있도록 함
          const promise = (async () => {
            try {
              const imageMarker = await OverlayService.createOverlayOfLandmarkMarker(this._mapInstance, item, sectionName);
              if (imageMarker) {
                // 이미 존재하는지 체크하여 중복 등록 방지
                const isDuplicate = overlayLayersBySection.landmarks.imageMarkers.some(
                  existing => existing.itemId === item.id
                );
                
                if (!isDuplicate) {
                  overlayLayersBySection.landmarks.imageMarkers.push(imageMarker); // 비동기 생성된 이미지마커를 레이어에 추가함. 
                  results.landmarks.imageMarkers++;

                  // 현재 레이어의 가시성 상태 확인하고 토글 처리
                  const isLayerVisible = overlayLayersBySection.overlayLayerVisibles.landmarksMarker;
                  if (isLayerVisible) {
                    // 레이어가 보이는 상태일 때만 오버레이도 보이게 토글
                    await imageMarker.toggleVisible();
                  }

                } else {
                  console.log(`[DEBUG] 중복된 랜드마크 마커 건너뜀: ${item.id || 'unknown'}`);
                }
              }
            } catch (error) {
              console.error(`[ERROR] 랜드마크 마커 생성 중 오류: ${error.message}`);
            }
          })();
          pendingPromises.push(promise);
        }
          break;
        case 'hotspots': // Constants.HOTSPOTS_MARKER 레이어 생성
        if (item.pinCoordinates) {
          const imageMarker = OverlayService.createOverlayOfHotspotMarker(this._mapInstance, item, sectionName);
          if (imageMarker) {
            overlayLayersBySection.hotspots.imageMarkers.push(imageMarker);
            results.hotspots.imageMarkers++;
            
            // 현재 레이어의 가시성 상태 확인하고 토글 처리
            const isLayerVisible = overlayLayersBySection.overlayLayerVisibles.hotspotsMarker;
            if (isLayerVisible) {
              // 레이어가 보이는 상태일 때만 오버레이도 보이게 토글
              imageMarker.toggleVisible();
            }
          }
        }
          break;
      }
    }
    
    // 모든 비동기 작업이 완료될 때까지 대기
    if (pendingPromises.length > 0) {
      await Promise.all(pendingPromises);
    }
    
    // 현재 활성 섹션 & 줌 레벨에 따라 가시성 업데이트
    if (this._activeSection === sectionName) {
      this._updateVisibilityForZoom();
    }
    
    console.log(`[DEBUG] 오버레이 일괄 등록 완료: ${sectionName}`);
    console.log(`  - 상점 마커: ${overlayLayersBySection.shops.markers.length}개`);
    console.log(`  - 상점 폴리곤: ${overlayLayersBySection.shops.polygons.length}개`);
    console.log(`  - 랜드마크 마커: ${overlayLayersBySection.landmarks.imageMarkers.length}개`);
    console.log(`  - 핫스팟 마커: ${overlayLayersBySection.hotspots.imageMarkers.length}개`);
    
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
   * @return {Promise<boolean>} 성공 여부
   * @private
   */
  _toggleLayerVisibility: async function(sectionName, layerType) {
    
    
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
    
    
    let overlays = [];
    let successCount = 0;
    let failCount = 0;
    
    // 레이어 타입에 따른 오버레이 배열 가져오기 - layerInfo 사용하여 수정
    const sectionCategory = layerInfo.section;
    const collectionName = layerInfo.collection;
    
    // section 내에서 해당 카테고리와 컬렉션이 존재하는지 확인
    if (section[sectionCategory] && Array.isArray(section[sectionCategory][collectionName])) {
      overlays = section[sectionCategory][collectionName];
      
      
    } else {
      console.warn(`[WARN] 오버레이 배열을 찾을 수 없음: ${sectionCategory}.${collectionName}`);
    }
    
    // 오버레이 배열 반복하며 가시성 토글
    // 모든 토글 작업을 프로미스로 수행 (비동기 가능성 대비)
    const togglePromises = overlays.map(async (overlay, index) => {
      try {
        await overlay.toggleVisible();
        successCount++;
        return true;
      } catch (error) {
        console.error(`[ERROR] 오버레이 토글 중 오류 발생: ${error.message}`);
        failCount++;
        return false;
      }
    });
    
    // 모든 토글 작업 완료 대기
    await Promise.all(togglePromises);
    
    // 레이어 상태 업데이트
    section.overlayLayerVisibles[overlayVisibleKey] = targetVisibility;
    
    console.log(`[DEBUG] 레이어 가시성 토글 완료: ${layerType} (섹션: ${sectionName}, 새 상태: ${targetVisibility ? '보임' : '숨김'}, 성공: ${successCount}, 실패: ${failCount})`);
    
    return true;
  },
  
  /**
   * 줌 레벨에 따른 레이어 가시성 업데이트
   * @private
   */
  _updateVisibilityForZoom: async function() {
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
    
    // 토글 작업을 위한 프로미스 배열
    const togglePromises = [];
    
    // 각 레이어의 가시성 업데이트
    Object.entries(LAYER_CONSTANTS).forEach(([layerType, layerInfo]) => {
      const shouldBeVisible = (
        currentZoom >= layerInfo.MIN_ZOOM && 
        currentZoom <= layerInfo.MAX_ZOOM
      );

      
      // 이 레이어에 속한 오버레이 개수 확인 (특히 랜드마크 마커)
      const sectionCategory = layerInfo.section;
      const collectionName = layerInfo.collection;
            
      const visibilityKey = layerInfo.overlayVisibleKey;
      const currentVisibility = section.overlayLayerVisibles[visibilityKey];
      
      // 가시성 상태 변경이 필요한 경우만 업데이트
      if (currentVisibility !== shouldBeVisible) {
        // 현재 상태가 목표 상태와 다를 경우만 토글

        const togglePromise = this._toggleLayerVisibility(this._activeSection, layerType);
        togglePromises.push(togglePromise);
        
        // 상태 직접 업데이트 (toggleLayerVisibility에서 변경된 상태가 유지되지 않으므로 여기서 직접 설정)
        section.overlayLayerVisibles[visibilityKey] = shouldBeVisible;
        

      } else {
        //console.log(`[DEBUG] 레이어 가시성 변경 불필요: ${layerType}는 이미 ${shouldBeVisible ? '표시' : '숨김'} 상태임`);
      }
    });
    
    // 모든 토글 작업이 완료될 때까지 대기
    if (togglePromises.length > 0) {
      await Promise.all(togglePromises);
    }
    
    
    // 각 레이어별 가시성 상태와 아이템 개수 로그
    const visibleItemCounts = {
      shopsMarker: section.overlayLayerVisibles.shopsMarker ? (section.shops?.markers?.length || 0) : 0,
      shopsPolygon: section.overlayLayerVisibles.shopsPolygon ? (section.shops?.polygons?.length || 0) : 0,
      landmarksMarker: section.overlayLayerVisibles.landmarksMarker ? (section.landmarks?.imageMarkers?.length || 0) : 0,
      hotspotsMarker: section.overlayLayerVisibles.hotspotsMarker ? (section.hotspots?.imageMarkers?.length || 0) : 0
    };
    

  }
};

export default MapOverlayManager; 