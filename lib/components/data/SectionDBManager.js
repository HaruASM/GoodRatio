/**
 * SectionDBManager.js
 * 인메모리 DB인 sectionsDB를 관리하는 모듈
 * 섹션별로 데이터를 캐싱해서 제공
 * 로컬,서버관리하는 모듈의 getSectionData 인터페이스 이용 -> sectionDB용 서버데이터셋 로드 -> 클라이언트데이터셋 변환
 * cache에서 반환시 마커,오버레이 포함
 */

import { getSectionData, getSectionCollectionData, setupFirebaseListener } from '../../services/serverUtils';
import { protoitemdataSet } from '../../models/editorModels';

// 모듈 상태 (싱글톤 패턴)
const moduleState = {
  // 섹션 데이터 캐시 (Map 객체)
  _cache: new Map(),
  
  // 실시간 리스너 관리용 속성
  _currentListener: null,
  _currentSectionName: null,
};

/**
 * SectionDBManager 모듈
 * sectionsDBManagerOfEditor와 동일한 인터페이스 제공하지만 모듈 매니저에서 관리되는 전역 모듈
 */
const SectionDBManager = {
  /**
   * 모듈 초기화 메서드 (ModuleManager에서 호출됨)
   */
  initialize: function() {
    console.log('[SectionDBManager] 모듈 초기화');
    
    // 필요한 초기화 로직
    document.addEventListener('section-items-updated', this._handleSectionUpdate);
    
    return this;
  },
  
  /**
   * 모듈 정리 메서드 (ModuleManager에서 호출됨)
   */
  cleanup: function() {
    console.log('[SectionDBManager] 모듈 정리');
    
    // 실시간 리스너 정리
    if (moduleState._currentListener) {
      moduleState._currentListener();
      moduleState._currentListener = null;
      moduleState._currentSectionName = null;
    }
    
    // 이벤트 리스너 제거
    document.removeEventListener('section-items-updated', this._handleSectionUpdate);
    
    // 캐시 초기화
    moduleState._cache.clear();
  },
  
  /**
   * 모듈 일시중단 메서드 (ModuleManager에서 호출됨)
   */
  suspend: function() {
    console.log('[SectionDBManager] 모듈 일시중단');
    
    // 실시간 리스너만 정리 (캐시는 유지)
    if (moduleState._currentListener) {
      moduleState._currentListener();
      moduleState._currentListener = null;
      moduleState._currentSectionName = null;
    }
  },
  
  /**
   * 모듈 재개 메서드 (ModuleManager에서 호출됨)
   */
  resume: function() {
    console.log('[SectionDBManager] 모듈 재개');
    
    // 활성 섹션이 있었다면 리스너 재설정
    if (moduleState._currentSectionName) {
      this._setupRealtimeListener(moduleState._currentSectionName);
    }
  },
  
  /**
   * 섹션 데이터 가져오기 (캐시 -> 로컬 스토리지 -> 서버 순으로 시도)
   * @param {string} sectionName - 가져올 섹션 이름
   * @returns {Promise<Array>} - 변환된 아이템 리스트 (protoitemdataSet 형태)
   */
  getSectionItems: async function(sectionName) {
    console.log(`[SectionDBManager] ${sectionName} 섹션 데이터 요청`);
    
    // 1. 캐시에서 먼저 확인
    if (moduleState._cache.has(sectionName)) {
      if (moduleState._currentSectionName !== sectionName) {
        this._setupRealtimeListener(sectionName);
      }
      
      return moduleState._cache.get(sectionName);
    }
    
    try {
      // 2. 캐시에 없으면 getSectionData 함수 호출 (로컬 스토리지 -> 서버)
      const serverItems = await getSectionData(sectionName);
      
      // 3. 서버 형식(protoServerDataset)에서 클라이언트 형식(protoitemdataSet)으로 변환
      // 서버 아이템이 있는 경우만 변환 및 캐시 저장
      let clientItems = [];
      if (serverItems && serverItems.length > 0) {
        clientItems = this._transformToClientFormat(serverItems, sectionName);
        
        // 4. 캐시에 저장
        moduleState._cache.set(sectionName, clientItems);
      }
      
      // 5. 실시간 리스너 설정 (서버 아이템이 없는 경우에도 리스너는 설정해야 함)
      this._setupRealtimeListener(sectionName);
      
      return clientItems;
    } catch (error) {
      console.error(`[SectionDBManager] ${sectionName} 데이터 로드 오류`, error);
      
      // 오류 발생해도 리스너 설정은 시도
      this._setupRealtimeListener(sectionName);
      
      return [];
    }
  },
  
  /**
   * 실시간 리스너 설정 (내부 메서드)
   * @param {string} sectionName - 실시간 업데이트를 구독할 섹션 이름
   * @private
   */
  _setupRealtimeListener: function(sectionName) {
    // 이미 같은 섹션에 리스너가 있으면 재사용
    if (moduleState._currentSectionName === sectionName && moduleState._currentListener) {
      return;
    }
    
    console.log(`[SectionDBManager] ${sectionName} 섹션에 실시간 리스너 설정`);
    
    // 다른 섹션의 리스너가 있으면 정리
    if (moduleState._currentListener) {
      moduleState._currentListener();
      moduleState._currentListener = null;
      moduleState._currentSectionName = null;
    }
    
    // 새 리스너 설정
    moduleState._currentListener = setupFirebaseListener(sectionName, (updatedItems, changes) => {
      console.log('[SectionDBManager] 실시간 리스너 콜백 동작', updatedItems);
      
      // 서버의 counterUpdated 값과 updatedCollections 배열 확인
      const sectionDoc = updatedItems ? updatedItems.sectionDoc : null;
      if (!sectionDoc) {
        console.log('[SectionDBManager] 섹션 문서 정보가 없습니다.');
        return;
      }
      
      const serverCounter = sectionDoc.counterUpdated;
      const serverCounterCollections = sectionDoc.counterCollections || {};
      
      // 로컬 스토리지에서 카운터 값과 컬렉션 정보 가져오기
      const localCounter = localStorage.getItem(`${sectionName}_counter`) || "0";
      const localCounterValue = parseInt(localCounter);
      
      let localCollections = {};
      try {
        const savedCollections = localStorage.getItem(`${sectionName}_collections`);
        if (savedCollections) {
          localCollections = JSON.parse(savedCollections);
        }
      } catch (e) {
        console.error('[SectionDBManager] 로컬 컬렉션 정보 파싱 오류:', e);
        localCollections = {};
      }
      
      // 변경 여부 확인 - 서버 카운터가 로컬보다 큰 경우 업데이트 필요
      const shouldUpdate = serverCounter > localCounterValue;
      
      if (shouldUpdate) {
        console.log(`[SectionDBManager] ${sectionName} 섹션 업데이트 필요 (카운터: ${localCounterValue} -> ${serverCounter})`);
        
        // 변경된 컬렉션 식별 및 데이터 가져오기
        const updatedCollectionsPromises = [];
        
        // 서버의 컬렉션 정보 순회 (Map 구조 사용)
        Object.entries(serverCounterCollections).forEach(([collectionName, collectionData]) => {
          // 로컬에 해당 컬렉션 정보가 있는지 확인
          const localCollectionData = localCollections[collectionName] || { counter: 0 };
          
          // 컬렉션이 없거나 서버 카운터가 더 큰 경우 업데이트 필요
          if (!localCollectionData || collectionData.counter > localCollectionData.counter) {
            console.log(`[SectionDBManager] 컬렉션 업데이트 필요: ${collectionName} (${localCollectionData.counter || 0} -> ${collectionData.counter})`);
            
            // 해당 컬렉션의 데이터 가져오기 작업 추가
            updatedCollectionsPromises.push(
              getSectionCollectionData(sectionName, collectionName)
                .then(collectionData => {
                  return {
                    nameCollection: collectionName,
                    counter: collectionData.counter || (serverCounterCollections[collectionName]?.counter || 0),
                    data: collectionData
                  };
                })
            );
          }
        });
        
        // 모든 변경된 컬렉션 데이터 가져오기 완료 대기
        Promise.all(updatedCollectionsPromises)
          .then(collectionsData => {
            // 각 컬렉션 데이터를 처리
            collectionsData.forEach(collection => {
              // 데이터가 items 컬렉션인 경우 특별 처리
              if (collection.nameCollection === 'items' && collection.data.length > 0) {
                // 서버 데이터를 클라이언트 형식으로 변환
                const clientItems = this._transformToClientFormat(collection.data, sectionName);
                
                // 캐시 업데이트
                moduleState._cache.set(sectionName, clientItems);
                
                // 이벤트 발생
                document.dispatchEvent(new CustomEvent('section-items-updated', {
                  detail: { sectionName, items: clientItems, serverLastUpdated: serverCounter }
                }));
              } else if (collection.data.length > 0) {
                // 다른 컬렉션 데이터도 캐시에 저장 (필요시 별도 이벤트 발생)
                // 현재는 items 컬렉션만 처리하도록 구현
              }
            });
            
            // 로컬 스토리지에 카운터와 컬렉션 정보 업데이트
            localStorage.setItem(`${sectionName}_counter`, serverCounter.toString());
            localStorage.setItem(`${sectionName}_collections`, JSON.stringify(serverCounterCollections));
            
            console.log(`[SectionDBManager] ${sectionName} 섹션 데이터 업데이트 완료 (카운터: ${serverCounter})`);
          })
          .catch(error => {
            console.error(`[SectionDBManager] 컬렉션 데이터 가져오기 오류:`, error);
          });
      } else {
        console.log(`[SectionDBManager] ${sectionName} 섹션에 실제 변경사항 없음, 업데이트 건너뜀 (로컬: ${localCounterValue}, 서버: ${serverCounter})`);
      }
    });
    
    moduleState._currentSectionName = sectionName;
  },
  
  /**
   * 현재 캐시에 있는 섹션 데이터 가져오기 (비동기 로드 없음)
   * @param {string} sectionName - 가져올 섹션 이름
   * @returns {Array} - 캐시된 아이템 리스트 또는 빈 배열
   */
  getCachedItems: function(sectionName) {
    return moduleState._cache.get(sectionName) || [];
  },
  
  /**
   * ID와 섹션 이름으로 특정 아이템 찾기
   * @param {string} id - 아이템 ID
   * @param {string} sectionName - 섹션 이름
   * @returns {Object|null} - 찾은 아이템 또는 null
   */
  getItemByIDandSectionName: function(id, sectionName) {
    // 캐시에서 해당 섹션의 아이템 목록 가져오기
    const items = moduleState._cache.get(sectionName);
    
    // 아이템 목록이 없으면 null 반환
    if (!items || items.length === 0) {
      console.log(`[SectionDBManager] ${sectionName} 섹션에 아이템이 없습니다`);
      return null;
    }
    
    // ID로 아이템 찾기
    const item = items.find(item => {
      // serverDataset.id 또는 id 속성 확인
      const itemId = item.serverDataset?.id || item.id;
      return itemId === id;
    });
    
    if (!item) {
      console.log(`[SectionDBManager] ${sectionName} 섹션에서 ID가 ${id}인 아이템을 찾을 수 없습니다`);
    }
    
    return item || null;
  },
  
  /**
   * 서버 형식에서 클라이언트 형식으로 데이터 변환 - 오버레이 생성(등록)도 포함
   * @param {Array} serverItems - 서버 형식 아이템 리스트 (protoServerDataset 형태)
   * @param {string} sectionName - 섹션 이름
   * @returns {Array} - 변환된 아이템 리스트 (protoitemdataSet 형태)
   * @private
   */
  _transformToClientFormat: function(serverItems, sectionName) {
    // 오버레이 등록 처리
    if (!sectionName) {
      console.error('[SectionDBManager] 섹션 이름이 제공되지 않았습니다.');
      return [];
    }

    // serverItems가 없거나 빈 배열이면 빈 배열 반환
    if (!serverItems || !Array.isArray(serverItems) || serverItems.length === 0) {
      console.log(`[SectionDBManager] ${sectionName} 섹션에 대한 서버 아이템이 없습니다.`);
      return [];
    }

    // ModuleManager를 통해 MapOverlayManager 모듈 접근
    if (typeof ModuleManager !== 'undefined') {
      const mapOverlayManager = ModuleManager.loadGlobalModule('mapOverlayManager');
      if (mapOverlayManager) {
        // MapOverlayManager에 전체 아이템 리스트 등록 (일괄 처리)
        mapOverlayManager.registerOverlaysByItemlist(
          sectionName, 
          serverItems  // protoServerDataset 데이터 배열 (각 항목에는 id, pinCoordinates, path 등 포함)
        );
      } else {
        console.warn('[SectionDBManager] MapOverlayManager 모듈이 아직 초기화되지 않았습니다.');
      }
    } else {
      console.warn('[SectionDBManager] ModuleManager가 정의되지 않았습니다.');
    }

    return serverItems.map(item => {
      const clientItems = {
        ...protoitemdataSet,
        serverDataset: { ...item }
      };
      
      return clientItems;
    });
  },
  
  /**
   * 섹션 데이터 업데이트
   * @param {string} sectionName - 업데이트할 섹션 이름
   * @param {Array} items - 업데이트할 아이템 리스트
   */
  updateSection: function(sectionName, items) {
    // 캐시만 업데이트 (로컬 스토리지에는 저장하지 않음)
    moduleState._cache.set(sectionName, items);
  },
  
  /**
   * 캐시 초기화
   */
  clearCache: function() {
    moduleState._cache.clear();
  },
  
  /**
   * 섹션 업데이트 이벤트 핸들러
   * @param {CustomEvent} event - 섹션 업데이트 이벤트 객체
   * @private
   */
  _handleSectionUpdate: function(event) {
    const { sectionName, items, serverLastUpdated } = event.detail;
    if (!sectionName || !items) return;
    
    // 로컬 스토리지 키
    const localStorageKey = `${sectionName}_lastUpdated`;
    
    // 로컬 스토리지에서 마지막 업데이트 타임스탬프 가져오기
    const localLastUpdated = localStorage.getItem(localStorageKey);
    
    // 업데이트 여부 확인 (타임스탬프가 없거나 서버 타임스탬프가 더 최신)
    const shouldUpdate = !localLastUpdated || (serverLastUpdated && serverLastUpdated > parseInt(localLastUpdated));
    
    if (shouldUpdate) {
      console.log(`[SectionDBManager] ${sectionName} 섹션 UI 업데이트 필요`);
      
      // 캐시 업데이트
      moduleState._cache.set(sectionName, items);
      
      // 로컬 스토리지에 마지막 업데이트 타임스탬프 저장
      if (serverLastUpdated) {
        localStorage.setItem(localStorageKey, serverLastUpdated);
      }
    } else {
      console.log(`[SectionDBManager] ${sectionName} 섹션에 실제 변경사항 없음, UI 업데이트 건너뜀`);
    }
  }
};

export default SectionDBManager; 