/**
 * SectionDBManager.js
 * 인메모리 DB인 sectionsDB를 관리하는 모듈
 * 섹션별로 데이터를 캐싱해서 제공
 * 로컬,서버관리하는 모듈의 getSectionData 인터페이스 이용 -> sectionDB용 서버데이터셋 로드 -> 클라이언트데이터셋 변환
 * cache에서 반환시 마커,오버레이 포함
 * 
 * [작동 방식 상세 설명]
 * 1. 데이터 관리:
 *    - Firebase의 sections 콜렉션에서 섹션별 데이터 관리
 *    - 각 섹션 문서는 counterUpdated, counterCollections 필드로 변경 사항 추적
 *    - 로컬 스토리지와 타임스태프 비교하여 필요한 데이터만 갱신
 * 
 * 2. 리스너 관리:
 *    - 섹션별 리스너: 한 번에 하나의 섹션만 리스닝 (섹션별 리스너 재사용)
 *    - Firebase onSnapshot 이벤트로 실시간 데이터 변경 감지
 *    - 섹션 변경 시 이전 리스너 정리하고 새 리스너 설정
 * 
 * 3. 구독자 관리:
 *    - 섹션명 구분 없이 모든 구독자에게 현재 섹션명과 아이템 리스트 함께 전달
 *    - 구독자는 필요한 섹션 데이터만 선택적으로 처리
 *    - subscribeForSetionAndItemlist() 호출로 구독 시작, 반환된 함수 호출로 구독 해제
 * 
 * 4. 데이터 업데이트 흐름:
 *    - getSectionItems() 호출 -> _setupRealtimeListener() 설정 -> Firebase 업데이트 감지
 *    - 업데이트 필요 확인 -> 데이터 가져오기 -> 캐시 업데이트 -> _notifySubscribersForSectionAndItemlist() 호출
 * 
 * 5. 사용 예시:
 *    - 컴포넌트에서 const unsubscribe = SectionDBManager.subscribe((sectionName, items) => { ... });
 *    - 섹션 변경: SectionDBManager.getSectionItems('newSectionName');
 *    - 구독 해제: unsubscribe();
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
  
  // 오버레이 업데이트 제어를 위한 상태 변수
  _updateOverlays: true,
  
  // 구독자 관리를 위한 세트 (섹션명으로 구분하지 않고 모든 구독자에게 알림)
  _subscribers: new Set()
};

// 리스너 디바운싱을 위한 타이머
let debounceTimeout;

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
   * @param {boolean} updateOverlays - MapOverlayManager 업데이트 여부 (기본값: true)
   * @returns {Promise<Array>} - 변환된 아이템 리스트 (protoitemdataSet 형태)
   */

  //변경되는 섹션에 해당 데이터가 DB에 이미 있는지와 오버레이 존재 여부를 이 함수 내에서 판별하여 처리
  getSectionItems: async function(sectionName, updateOverlays = true) {
    console.log(`[SectionDBManager] ${sectionName} 섹션 데이터 요청 (오버레이 업데이트: ${updateOverlays})`);
    
    // 오버레이 업데이트 상태 저장 (비동기 업데이트에서 사용)
    moduleState._updateOverlays = updateOverlays;
    
    let clientItems = [];
    
    
    // 섹션 변경 여부 확인
    const isChangingSection = moduleState._currentSectionName !== sectionName;
    
    // 캐시에 데이터가 있으면 리스너만 설정하고 바로 반환
    // 섹션 변경 여부와 관계없이 캐시된 데이터 사용
    if (moduleState._cache.has(sectionName)) {
      // 리스너가 없는 경우에만 설정 시도 (오프라인→온라인 전환 대비)
      if (!moduleState._currentListener) {
        this._setupRealtimeListener(sectionName);
      }
      return moduleState._cache.get(sectionName);
    }
    
    // 1. 캐시에서 먼저 확인
    if (moduleState._cache.has(sectionName)) {
      // 캐시에 있는 경우 - 오버레이도 이미 생성되어 있음
      if (isChangingSection) {
        this._setupRealtimeListener(sectionName);
        
        // 섹션만 변경 (오버레이는 이미 생성되어 있음)
        if (updateOverlays) {
          try {
            const ModuleManager = (await import('../../moduleManager')).default;
            const mapOverlayManager = await ModuleManager.loadGlobalModule('mapOverlayManager');
            if (mapOverlayManager) {
              console.log(`[SectionDBManager] 캐시된 데이터 사용, 섹션 변경만 수행: ${sectionName}`);
              await mapOverlayManager.changeSection(sectionName);
              moduleState._currentSectionName = sectionName;
            }
          } catch (error) {
            console.error(`[SectionDBManager] MapOverlayManager 섹션 변경 중 오류:`, error);
          }
        }
      }
      
      clientItems = moduleState._cache.get(sectionName);
    } else {
      try {
        // 2. 캐시에 없으면 데이터 로드 (로컬스토리지만 확인, 로컬스토리지 없으면 빈배열 [] )
        const serverItems = await getSectionData(sectionName);
        
        // 3. 서버 아이템이 로컬스토리지에 있는 경우 변환 및 오버레이 등록
        if (serverItems && serverItems.length > 0) {
          // _transformToClientFormat에서 오버레이 등록 및 변경 포함
          clientItems = await this._transformToClientFormat(serverItems, sectionName);
          
          // 4. 캐시에 저장
          moduleState._cache.set(sectionName, clientItems);
          
          // 섹션 이름 업데이트 (오버레이는 _transformToClientFormat에서 이미 등록됨)
          if (isChangingSection) {
            moduleState._currentSectionName = sectionName;
          }
        }
        
        // 5. 실시간 리스너 설정 - 로컬스토리지에 itemlist있거나, 없거나 모든 케이스에서 사용 
        this._setupRealtimeListener(sectionName);
        
      } catch (error) {
        console.error(`[SectionDBManager] ${sectionName} 데이터 로드 오류`, error);
        this._setupRealtimeListener(sectionName);
      }
    }
    
    return clientItems;
  },
  
  /**
   * Firebase 실시간 리스너 설정 (디바운싱 적용)
   * @param {string} sectionName - 섹션 이름
   * @private
   */
  _setupRealtimeListener: function(sectionName) {
    // 이미 같은 섹션에 리스너가 설정되어 있으면 중복 설정 방지
    if (moduleState._currentSectionName === sectionName && moduleState._currentListener) {
      console.log(`[SectionDBManager] ${sectionName} 섹션 리스너가 이미 활성화되어 있음`);
      return;
    }
    
    // 디바운싱 처리 - 이전 타이머가 있으면 취소
    if (moduleState._listenerSetupTimer) {
      clearTimeout(moduleState._listenerSetupTimer);
      moduleState._listenerSetupTimer = null;
      console.log(`[SectionDBManager] 리스너 설정 타이머 취소`);
    }
    
    // 새로운 타이머 설정 (300ms 디바운싱)
    moduleState._listenerSetupTimer = setTimeout(() => {
      // 기존 리스너가 있으면 제거
      if (moduleState._currentListener) {
        moduleState._currentListener();
        moduleState._currentListener = null;
        console.log(`[SectionDBManager] ${moduleState._currentSectionName} 섹션 리스너 제거`);
      }
      
      console.log(`[SectionDBManager] ${sectionName} 섹션에 실시간 리스너 설정`);
      
      // 기존 setupFirebaseListener 사용
      moduleState._currentListener = setupFirebaseListener(sectionName, async (updatedItems, changes) => {
        const sectionDoc = updatedItems ? updatedItems.sectionDoc : null;
        if (!sectionDoc) {
          console.log('[SectionDBManager] 섹션 문서 정보가 없습니다.');
          return;
        }
        
        // 서버의 counterUpdated 값과 updatedCollections 배열 확인
        const serverCounter = sectionDoc.counterUpdated;
        const serverCounterCollections = sectionDoc.counterCollections || {};
        
        // 로컬 스토리지에서 카운터 값과 커렉션 정보 가져오기
        const localCounter = localStorage.getItem(`${sectionName}_counter`) || "0";
        const localCounterValue = parseInt(localCounter);
        
        let localCollections = {};
        try {
          const savedCollections = localStorage.getItem(`${sectionName}_collections`);
          if (savedCollections) {
            localCollections = JSON.parse(savedCollections);
          }
        } catch (e) {
          console.error('[SectionDBManager] 로컬 커렉션 정보 파싱 오류:', e);
          localCollections = {};
        }
        
        // 변경 여부 확인 - 서버 카운터가 로컬보다 큰 경우 업데이트 필요
        const shouldUpdate = serverCounter > localCounterValue;
        
        if (shouldUpdate) {
          console.log(`[SectionDBManager] ${sectionName} 섹션 업데이트 필요 (카운터: ${localCounterValue} -> ${serverCounter})`);
          
          // 변경된 커렉션 식별 및 데이터 가져오기
          const updatedCollectionsPromises = [];
          
          // 서버의 커렉션 정보 순회 (Map 구조 사용)
          Object.entries(serverCounterCollections).forEach(([collectionName, collectionData]) => {
            // 로컬에 해당 커렉션 정보가 있는지 확인
            const localCollectionData = localCollections[collectionName] || { counter: 0 };
            
            // 커렉션이 없거나 서버 카운터가 더 큰 경우 업데이트 필요
            if (!localCollectionData || collectionData.counter > localCollectionData.counter) {
              console.log(`[SectionDBManager] 커렉션 업데이트 필요: ${collectionName} (${localCollectionData.counter || 0} -> ${collectionData.counter})`);
              
              // 해당 커렉션의 데이터 가져오기 작업 추가
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
          
          try {
            // 모든 변경된 커렉션 데이터 가져오기 완료 대기
            const collectionsData = await Promise.all(updatedCollectionsPromises);
            
            // 각 커렉션 데이터를 처리
            for (const collection of collectionsData) {
              // 데이터가 items 커렉션인 경우 특별 처리
              if (collection.nameCollection === 'items' && collection.data.length > 0) {
                // 서버 데이터를 클라이언트 형식으로 변환
                const clientItems = await this._transformToClientFormat(collection.data, sectionName);
                
                // 캐시 업데이트
                moduleState._cache.set(sectionName, clientItems);
                
                // 구독자에게 알림 (구독 패턴 적용) - sectionName과 함께 전달
                this._notifySubscribersForSectionAndItemlist(sectionName, clientItems);
                
                // 이벤트 발생 (기존 호환성 유지)
                document.dispatchEvent(new CustomEvent('section-items-updated', {
                  detail: { sectionName, items: clientItems, serverLastUpdated: serverCounter }
                }));
              } else if (collection.data.length > 0) {
                // 다른 커렉션 데이터도 캐시에 저장 (필요시 별도 이벤트 발생)
                // 현재는 items 커렉션만 처리하도록 구현
              }
            }
            
            // 로컬 스토리지에 카운터와 커렉션 정보 업데이트
            localStorage.setItem(`${sectionName}_counter`, serverCounter.toString());
            localStorage.setItem(`${sectionName}_collections`, JSON.stringify(serverCounterCollections));
            
            console.log(`[SectionDBManager] ${sectionName} 섹션 데이터 업데이트 완료 (카운터: ${serverCounter})`);
          } catch (error) {
            console.error(`[SectionDBManager] 커렉션 데이터 가져오기 오류:`, error);
          }
        } else {
          console.log(`[SectionDBManager] ${sectionName} 섹션에 실제 변경사항 없음, 업데이트 건너뛰 (로컬: ${localCounterValue}, 서버: ${serverCounter})`);
        }
      });
      
      // 현재 섹션 이름 저장
      moduleState._currentSectionName = sectionName;
      console.log(`[SectionDBManager] ${sectionName} 섹션 실시간 리스너 설정 완료`);
      
      // 타이머 초기화
      moduleState._listenerSetupTimer = null;
    }, 300); // 300ms 디바운싱 적용
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
   * @returns {Promise<Array>} - 변환된 아이템 리스트 (protoitemdataSet 형태)
   * @private
   */
  _transformToClientFormat: async function(serverItems, sectionName) {
    // serverItems가 없거나 빈 배열이면 빈 배열 반환
    if (!serverItems || !Array.isArray(serverItems) || serverItems.length === 0) {
      console.log(`[SectionDBManager] ${sectionName} 섹션에 대한 서버 아이템이 없습니다.`);
      return [];
    }

    // _updateOverlays 상태에 따라 오버레이 등록 여부 결정
    // 리스너 상태와 관계없이 오버레이 등록 (오프라인 상태 고려)
    if (moduleState._updateOverlays) {
      try {
        if (typeof ModuleManager !== 'undefined') {
          // 비동기적으로 MapOverlayManager 모듈 로드
          const mapOverlayManager = await ModuleManager.loadGlobalModuleAsync('mapOverlayManager');
          if (mapOverlayManager && typeof mapOverlayManager.registerOverlaysByItemlist === 'function') {
            console.log(`[SectionDBManager] ${sectionName} 섹션의 오버레이 등록 시작 (${serverItems.length}개 아이템)`);
            // MapOverlayManager에 전체 아이템 리스트 등록 (일괄 처리)
            await mapOverlayManager.registerOverlaysByItemlist(
              sectionName, 
              serverItems  // protoServerDataset 데이터 배열 (각 항목에는 id, pinCoordinates, path 등 포함)
            );
            
            // 오버레이 등록 후 섹션 변경 호출
            // 이것은 줌 레벨에 따른 가시성 업데이트를 트리거함 
            // TODO  mapOverlayManager.changeSection(sectionName)을 여기 자료 변환함수 내부에 두는 것이 맞는지.. 
            console.log(`[SectionDBManager] 오버레이 등록 후 changeSection 호출: ${sectionName}`);
            await mapOverlayManager.changeSection(sectionName);
            
            // 현재 섹션 업데이트
            moduleState._currentSectionName = sectionName;
          } else {
            console.warn('[SectionDBManager] MapOverlayManager 모듈이 초기화되지 않았거나 registerOverlaysByItemlist 메서드가 없습니다.');
          }
        } else {
          console.warn('[SectionDBManager] ModuleManager가 정의되지 않았습니다.');
        }
      } catch (error) {
        console.error(`[SectionDBManager] MapOverlayManager 모듈 로드 중 오류 발생:`, error);
      }
    } else {
      console.log(`[SectionDBManager] ${sectionName} 섹션의 오버레이 등록 건너뛰 (_updateOverlays: false)`);
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
      
      // 구독자에게 알림
      this._notifySubscribersForSectionAndItemlist(sectionName, items);
      
      // 로컬 스토리지에 마지막 업데이트 타임스탬프 저장
      if (serverLastUpdated) {
        localStorage.setItem(localStorageKey, serverLastUpdated);
      }
    } else {
      console.log(`[SectionDBManager] ${sectionName} 섹션에 실제 변경사항 없음, UI 업데이트 건너뜀`);
    }
  },
  
  /**
   * 구독자들에게 데이터 변경 알림
   * @param {string} sectionName - 변경된 섹션 이름
   * @param {Array} items - 변경된 아이템 리스트
   * @private
   */
  _notifySubscribersForSectionAndItemlist: function(sectionName, items) {
    if (moduleState._subscribers.size === 0) return;
    
    console.log(`[SectionDBManager] 구독자 ${moduleState._subscribers.size}명에게 ${sectionName} 섹션 업데이트 알림`);
    
    // 동기적으로 직접 처리 (구독자가 적은 경우)
    moduleState._subscribers.forEach(callback => {
      try {
        // sectionName과 items를 함께 전달
        callback(sectionName, items);
      } catch (error) {
        console.error('[SectionDBManager] 구독자 콜백 실행 중 오류:', error);
      }
    });
  },
  
  
  /**
   * 섹션 데이터 변경 구독
   * @param {Function} callback - 데이터 변경 시 호출될 콜백 함수 (sectionName, items 두 개의 매개변수 받음)
   * @returns {Function} - 구독 해제 함수
   */
  subscribeForSetionAndItemlist: function(callback) {
    moduleState._subscribers.add(callback);
    
    console.log(`[SectionDBManager] 구독자 추가, 현재 ${moduleState._subscribers.size}명`);
    
    // 현재 활성화된 섹션이 있고 캐시에 데이터가 있으면 즉시 콜백 호출
    if (moduleState._currentSectionName && moduleState._cache.has(moduleState._currentSectionName)) {
      const sectionName = moduleState._currentSectionName;
      const items = moduleState._cache.get(sectionName);
      setTimeout(() => callback(sectionName, items), 0);
    }
    
    // 구독 해제 함수 반환
    return () => {
      moduleState._subscribers.delete(callback);
      console.log(`[SectionDBManager] 구독 해제, 남은 구독자: ${moduleState._subscribers.size}명`);
    };
  },
  
  /**
   * 섹션 데이터 변경 구독 (subscribeForSetionAndItemlist의 별칭)
   * @param {Function} callback - 데이터 변경 시 호출될 콜백 함수 (sectionName, items 두 개의 매개변수 받음)
   * @returns {Function} - 구독 해제 함수
   */
  subscribe: function(callback) {
    console.log('[SectionDBManager] subscribe 호출됨 (subscribeForSetionAndItemlist 별칭)');
    return this.subscribeForSetionAndItemlist(callback);
  }
 
};

export default SectionDBManager; 