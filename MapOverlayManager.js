/**
 * 최적화된 MapOverlayManager - 심플하게 구성
 */
const MapOverlayManager = {
  // 오버레이 레이어 상수
  LAYER_CONSTANTS: {
    SHOPS_MARKER: { 
      name: 'SHOPS_MARKER',
      MIN_ZOOM: 12,
      MAX_ZOOM: 20
    },
    SHOPS_POLYGON: { 
      name: 'SHOPS_POLYGON',
      MIN_ZOOM: 14,
      MAX_ZOOM: 20
    },
    LANDMARKS_IMAGEMARKER: { 
      name: 'LANDMARKS_IMAGEMARKER',
      MIN_ZOOM: 10,
      MAX_ZOOM: 19
    },
    HOTSPOTS_MARKER: { 
      name: 'HOTSPOTS_MARKER',
      MIN_ZOOM: 14,
      MAX_ZOOM: 21
    }
  },
  
  // 섹션별 오버레이 그룹
  _overlayGroups: {},
  
  // 활성 섹션 배열
  _activeSections: [],
  
  // 현재 줌 레벨
  _currentZoom: 15,
  
  // 현재 가시성 상태를 저장하는 객체 (visibleAlready 패턴)
  _visibleAlready: {
    SHOPS_MARKER: new Set(),    // 보이는 상점 마커
    SHOPS_POLYGON: new Set(),   // 보이는 상점 폴리곤
    LANDMARKS_IMAGEMARKER: new Set(), // 보이는 랜드마크
    HOTSPOTS_MARKER: new Set()  // 보이는 핫스팟
  },
  
  /**
   * 초기화 함수
   */
  init: function() {
    this._setupZoomChangeListener();
    return this;
  },
  
  /**
   * 줌 변경 이벤트 리스너 설정
   */
  _setupZoomChangeListener: function() {
    const mapInstance = OverlayService.getMapInstance();
    if (!mapInstance) return;
    
    // 줌 변경 이벤트 핸들러
    const handleZoomChange = () => {
      const newZoom = mapInstance.getZoom();
      if (newZoom !== this._currentZoom) {
        this._currentZoom = newZoom;
        this._updateAllSectionsVisibilityByZoom(newZoom);
      }
    };
    
    // 이벤트 리스너 등록
    google.maps.event.addListener(mapInstance, 'zoom_changed', handleZoomChange);
  },
  
  /**
   * 오버레이 등록 함수
   * sectionName에 따라 오버레이 생성 후 활성 섹션에 추가
   */
  registerOverlaysByItemlist: function(sectionName, itemList) {
    if (!sectionName || !itemList || !Array.isArray(itemList)) {
      console.error('[MapOverlayManager] 오버레이 등록 실패: 잘못된 파라미터');
      return;
    }
    
    // 기존 오버레이 정리 (메모리 해제 없이 참조만 제거)
    if (this._overlayGroups[sectionName]) {
      // 활성 섹션에서 제거
      this._activeSections = this._activeSections.filter(s => s !== sectionName);
      
      // 기존 가시성 상태 초기화
      this._hideSectionOverlays(sectionName);
    }
    
    // 섹션별 오버레이 그룹 초기화 (분리된 구조)
    this._overlayGroups[sectionName] = {
      // 카테고리별 가시성 상태 (기본값: 모두 false)
      categoryVisibility: {
        SHOPS_MARKER: false,
        SHOPS_POLYGON: false,
        LANDMARKS_IMAGEMARKER: false,
        HOTSPOTS_MARKER: false
      },
      // 카테고리별 오버레이 (분리)
      shops: [],
      landmarks: [],
      hotspots: []
    };
    
    const mapInstance = OverlayService.getMapInstance();
    
    // 아이템 타입별로 분류
    const categorizedItems = {
      shops: itemList.filter(item => !item.category || item.category === 'shops'),
      landmarks: itemList.filter(item => item.category === 'landmarks'),
      hotspots: itemList.filter(item => item.category === 'hotspots')
    };
    
    // 상점 오버레이 생성 및 등록
    categorizedItems.shops.forEach(item => {
      const shopItem = {
        id: item.id,
        meta: {
          name: item.itemName || item.name || '',
          sectionName: sectionName
        }
      };
      
      // 상점 마커 생성 (좌표가 있는 경우)
      if (item.pinCoordinates) {
        const shopMarker = this._createShopMarker(item, sectionName);
        if (shopMarker) {
          shopMarker.setMap(mapInstance);
          shopMarker.setVisible(false); // 기본적으로 숨김
          shopItem.marker = shopMarker;
        }
      }
      
      // 상점 폴리곤 생성 (경로가 있는 경우)
      if (item.path && Array.isArray(item.path) && item.path.length >= 3) {
        const shopPolygon = this._createShopPolygon(item, sectionName);
        if (shopPolygon) {
          shopPolygon.setMap(mapInstance);
          shopPolygon.setVisible(false); // 기본적으로 숨김
          shopItem.polygon = shopPolygon;
        }
      }
      
      // 생성된 오버레이가 있는 경우만 추가
      if (shopItem.marker || shopItem.polygon) {
        this._overlayGroups[sectionName].shops.push(shopItem);
      }
    });
    
    // 랜드마크 오버레이 생성 및 등록
    categorizedItems.landmarks.forEach(item => {
      if (!item.pinCoordinates) return;
      
      const landmarkMarker = this._createLandmarkMarker(item, sectionName);
      if (landmarkMarker) {
        landmarkMarker.setMap(mapInstance);
        landmarkMarker.setVisible(false); // 기본적으로 숨김
        
        const landmarkItem = {
          id: item.id,
          pictureMarker: landmarkMarker,
          meta: {
            name: item.itemName || item.name || '',
            sectionName: sectionName,
            pictureUrl: item.pictureIcon || ''
          }
        };
        
        this._overlayGroups[sectionName].landmarks.push(landmarkItem);
      }
    });
    
    // 핫스팟 오버레이 생성 및 등록
    categorizedItems.hotspots.forEach(item => {
      if (!item.pinCoordinates) return;
      
      const hotspotMarker = this._createHotspotMarker(item, sectionName);
      if (hotspotMarker) {
        hotspotMarker.setMap(mapInstance);
        hotspotMarker.setVisible(false); // 기본적으로 숨김
        
        const hotspotItem = {
          id: item.id,
          marker: hotspotMarker,
          meta: {
            name: item.itemName || item.name || '',
            sectionName: sectionName
          }
        };
        
        this._overlayGroups[sectionName].hotspots.push(hotspotItem);
      }
    });
    
    console.log(`[MapOverlayManager] ${sectionName} 섹션에 오버레이 등록 완료`);
    
    // 활성 섹션에 추가하고 가시성 업데이트
    if (!this._activeSections.includes(sectionName)) {
      this._activeSections.push(sectionName);
      this._updateSectionVisibilityByZoom(sectionName, this._currentZoom);
    }
  },
  
  /**
   * 섹션 변경 함수
   */
  changeOverlaysOfCursection: function(sectionName) {
    return this.setActiveSections([sectionName]);
  },
  
  /**
   * 액티브 섹션 설정
   */
  setActiveSections: function(sectionNames) {
    if (!Array.isArray(sectionNames)) {
      sectionNames = [sectionNames]; // 문자열이면 배열로 변환
    }
    
    // 추가할 섹션과 제거할 섹션 계산
    const sectionsToRemove = this._activeSections.filter(
      section => !sectionNames.includes(section)
    );
    
    const sectionsToAdd = sectionNames.filter(
      section => !this._activeSections.includes(section)
    );
    
    // 1. 제거할 섹션의 오버레이 숨기기 (메모리 해제 없음)
    sectionsToRemove.forEach(sectionName => {
      if (this._overlayGroups[sectionName]) {
        this._hideSectionOverlays(sectionName);
      }
    });
    
    // 2. 활성 섹션 목록 업데이트
    this._activeSections = [...sectionNames];
    
    // 3. 추가할 섹션의 오버레이 가시성 업데이트
    sectionsToAdd.forEach(sectionName => {
      if (this._overlayGroups[sectionName]) {
        this._updateSectionVisibilityByZoom(sectionName, this._currentZoom);
      }
    });
    
    return true;
  },
  
  /**
   * 특정 섹션의 모든 오버레이 숨기기 (setMap(null) 하지 않음)
   */
  _hideSectionOverlays: function(sectionName) {
    const sectionGroup = this._overlayGroups[sectionName];
    if (!sectionGroup) return;
    
    // 각 카테고리별로 가시성 상태 확인 후 변경된 경우에만 처리
    Object.keys(this.LAYER_CONSTANTS).forEach(categoryKey => {
      // 현재 가시성이 true인 경우에만 처리 (변경이 필요한 경우)
      if (sectionGroup.categoryVisibility[categoryKey] === true) {
        // 가시성 상태 업데이트
        sectionGroup.categoryVisibility[categoryKey] = false;
        
        // 해당 카테고리의 오버레이 숨기기
        this._applyCategoryVisibility(sectionName, categoryKey, false);
      }
    });
  },
  
  /**
   * 모든 활성 섹션의 오버레이 가시성 업데이트
   */
  _updateAllSectionsVisibilityByZoom: function(zoomLevel) {
    // 각 활성 섹션에 대해 가시성 업데이트
    this._activeSections.forEach(sectionName => {
      if (this._overlayGroups[sectionName]) {
        this._updateSectionVisibilityByZoom(sectionName, zoomLevel);
      }
    });
  },
  
  /**
   * 특정 섹션의 가시성을 줌 레벨에 따라 업데이트
   */
  _updateSectionVisibilityByZoom: function(sectionName, zoomLevel) {
    const sectionGroup = this._overlayGroups[sectionName];
    if (!sectionGroup) return;
    
    // 각 카테고리별로 줌 레벨에 따른 가시성 결정 및 업데이트
    Object.keys(this.LAYER_CONSTANTS).forEach(categoryKey => {
      const category = this.LAYER_CONSTANTS[categoryKey];
      
      // 현재 줌 레벨이 해당 카테고리의 줌 범위에 있는지 확인
      const shouldBeVisible = 
        zoomLevel >= category.MIN_ZOOM && 
        zoomLevel <= category.MAX_ZOOM;
      
      // 이전 가시성 상태와 다른 경우에만 변경
      if (sectionGroup.categoryVisibility[categoryKey] !== shouldBeVisible) {
        // 가시성 상태 업데이트
        sectionGroup.categoryVisibility[categoryKey] = shouldBeVisible;
        
        // 해당 카테고리의 오버레이 가시성 업데이트
        this._applyCategoryVisibility(sectionName, categoryKey, shouldBeVisible);
      }
    });
  },
  
  /**
   * 줌 레벨이 카테고리 범위 내에 있는지 확인
   */
  _isInZoomRange: function(zoomLevel, category) {
    return zoomLevel >= category.MIN_ZOOM && zoomLevel <= category.MAX_ZOOM;
  },
  
  /**
   * 특정 카테고리의 오버레이 가시성 적용
   */
  _applyCategoryVisibility: function(sectionName, categoryKey, visible) {
    const sectionGroup = this._overlayGroups[sectionName];
    if (!sectionGroup) return;
    
    // 카테고리별 처리
    switch(categoryKey) {
      case 'SHOPS_MARKER':
        // 상점 마커인 경우, 마커가 있는 항목만 처리
        sectionGroup.shops.forEach(item => {
          if (item.marker) {
            item.marker.setVisible(visible);
            
            // visibleAlready 목록 업데이트
            if (visible) {
              this._visibleAlready.SHOPS_MARKER.add(item.id);
            } else {
              this._visibleAlready.SHOPS_MARKER.delete(item.id);
            }
          }
        });
        break;
        
      case 'SHOPS_POLYGON':
        // 상점 폴리곤인 경우, 폴리곤이 있는 항목만 처리
        sectionGroup.shops.forEach(item => {
          if (item.polygon) {
            item.polygon.setVisible(visible);
            
            // visibleAlready 목록 업데이트
            if (visible) {
              this._visibleAlready.SHOPS_POLYGON.add(item.id);
            } else {
              this._visibleAlready.SHOPS_POLYGON.delete(item.id);
            }
          }
        });
        break;
        
      case 'LANDMARKS_IMAGEMARKER':
        // 랜드마크 이미지 마커인 경우
        sectionGroup.landmarks.forEach(item => {
          if (item.pictureMarker) {
            item.pictureMarker.setVisible(visible);
            
            // visibleAlready 목록 업데이트
            if (visible) {
              this._visibleAlready.LANDMARKS_IMAGEMARKER.add(item.id);
            } else {
              this._visibleAlready.LANDMARKS_IMAGEMARKER.delete(item.id);
            }
          }
        });
        break;
        
      case 'HOTSPOTS_MARKER':
        // 핫스팟 마커인 경우
        sectionGroup.hotspots.forEach(item => {
          if (item.marker) {
            item.marker.setVisible(visible);
            
            // visibleAlready 목록 업데이트
            if (visible) {
              this._visibleAlready.HOTSPOTS_MARKER.add(item.id);
            } else {
              this._visibleAlready.HOTSPOTS_MARKER.delete(item.id);
            }
          }
        });
        break;
    }
  },
  
  /**
   * 현재 보이는 오버레이 ID 목록 가져오기
   * @param {string} categoryKey - 카테고리 키
   * @returns {Array} 현재 보이는 오버레이 ID 배열
   */
  getVisibleOverlayIds: function(categoryKey) {
    if (!this._visibleAlready[categoryKey]) {
      return [];
    }
    return Array.from(this._visibleAlready[categoryKey]);
  },
  
  /**
   * 특정 오버레이가 현재 보이는지 확인
   * @param {string} categoryKey - 카테고리 키
   * @param {string} id - 오버레이 ID
   * @returns {boolean} 가시성 여부
   */
  isOverlayVisible: function(categoryKey, id) {
    return this._visibleAlready[categoryKey]?.has(id) || false;
  },
  
  /**
   * 섹션 오버레이 제거 - 프로그램 종료 또는 모듈 제거 시에만 호출
   * setMap(null)로 메모리에서 완전히 해제
   */
  clearSectionOverlays: function(sectionName) {
    if (!sectionName || !this._overlayGroups[sectionName]) return;
    
    const sectionGroup = this._overlayGroups[sectionName];
    
    // 상점 오버레이 메모리 해제
    if (sectionGroup.shops && sectionGroup.shops.length > 0) {
      sectionGroup.shops.forEach(item => {
        if (item.marker) item.marker.setMap(null);
        if (item.polygon) item.polygon.setMap(null);
      });
    }
    
    // 랜드마크 오버레이 메모리 해제
    if (sectionGroup.landmarks && sectionGroup.landmarks.length > 0) {
      sectionGroup.landmarks.forEach(item => {
        if (item.pictureMarker) item.pictureMarker.setMap(null);
      });
    }
    
    // 핫스팟 오버레이 메모리 해제
    if (sectionGroup.hotspots && sectionGroup.hotspots.length > 0) {
      sectionGroup.hotspots.forEach(item => {
        if (item.marker) item.marker.setMap(null);
      });
    }
    
    // 활성 섹션 목록에서 제거
    this._activeSections = this._activeSections.filter(s => s !== sectionName);
    
    // 섹션 그룹 초기화
    delete this._overlayGroups[sectionName];
  },
  
  /**
   * 모든 리소스 정리 (컴포넌트 언마운트 시 호출)
   */
  cleanup: function() {
    // 모든 섹션의 모든 오버레이 메모리 해제
    Object.keys(this._overlayGroups).forEach(sectionName => {
      this.clearSectionOverlays(sectionName);
    });
    
    // 오버레이 그룹 초기화
    this._overlayGroups = {};
    
    // 활성 섹션 초기화
    this._activeSections = [];
    
    // visibleAlready 초기화
    Object.keys(this._visibleAlready).forEach(key => {
      this._visibleAlready[key].clear();
    });
    
    console.log('[MapOverlayManager] 모든 리소스가 정리되었습니다.');
  },
  
  /**
   * 상점 마커 생성 (기존 코드에서 가져와 사용)
   */
  _createShopMarker: function(item, sectionName) {
    // 구현은 기존 코드에서 가져와 사용
    // 해당 구현체는 프로젝트의 기존 마커 생성 로직에 따름
    return null; // 임시 리턴
  },
  
  /**
   * 상점 폴리곤 생성 (기존 코드에서 가져와 사용)
   */
  _createShopPolygon: function(item, sectionName) {
    // 구현은 기존 코드에서 가져와 사용
    // 해당 구현체는 프로젝트의 기존 폴리곤 생성 로직에 따름
    return null; // 임시 리턴
  },
  
  /**
   * 랜드마크 마커 생성 (기존 코드에서 가져와 사용)
   */
  _createLandmarkMarker: function(item, sectionName) {
    // 구현은 기존 코드에서 가져와 사용
    // 해당 구현체는 프로젝트의 기존 랜드마크 마커 생성 로직에 따름
    return null; // 임시 리턴
  },
  
  /**
   * 핫스팟 마커 생성 (기존 코드에서 가져와 사용)
   */
  _createHotspotMarker: function(item, sectionName) {
    // 구현은 기존 코드에서 가져와 사용
    // 해당 구현체는 프로젝트의 기존 핫스팟 마커 생성 로직에 따름
    return null; // 임시 리턴
  }
};

// 모듈 내보내기
export default MapOverlayManager; 