import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useSelector, useDispatch } from 'react-redux';
import styles from './stylesExploringItemsidebar.module.css';
import { 
  IMAGE_TEMPLATES, 
  createNextImageProps 
} from '../../lib/utils/imageHelpers';
import { 
  itemSelectedThunk,
  curSectionChangedThunk,
  selectcurrentSectionName
} from '../../lib/store/slices/mapEventSlice';
import {
  selectHighlightedItemId,
  selectIsSidebarVisible,
  toggleSidebarVisibility
} from '../../lib/store/slices/exploringSidebarSlice';
import ModuleManager from '../../lib/moduleManager';

/**
 * 좌측 사이드바 컴포넌트 - prop drilling 없이 직접 SectionDBManager와 통신
 * @returns {React.ReactElement} 좌측 사이드바 컴포넌트
 */
const ExploringItemSidebar = () => {
  // Redux 상태 및 디스패치 가져오기
  const dispatch = useDispatch();
  const highlightedItemId = useSelector(selectHighlightedItemId);
  const isSidebarVisible = useSelector(selectIsSidebarVisible);
  
  // Redux에서 현재 섹션 이름 가져오기
  const curSectionName = useSelector(selectcurrentSectionName);
  // 아이템 리스트는 컴포넌트 내부에서 관리
  const [curItemListInCurSection, setCurItemListInCurSection] = useState([]);
  
  // 이미지 props 관리를 위한 상태 추가
  const [itemImagesProps, setItemImagesProps] = useState({});
  // 이미지 로딩 상태 관리
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  // 각 아이템별 현재 표시중인 이미지 인덱스 관리
  const [currentImageIndexes, setCurrentImageIndexes] = useState({});
  // 카드 뷰 표시 상태
  const [viewMode, setViewMode] = useState('list'); // 'list', 'card', 'tour' 중 하나
  // 카드 뷰의 현재 슬라이드 시작 인덱스
  const [cardViewStartIndex, setCardViewStartIndex] = useState(0);
  
  // SectionDBManager 구독 해제 함수 참조 저장
  const unsubscribeRef = useRef(null);

  // SectionDBManager 구독을 통한 데이터 업데이트
  useEffect(() => {
    const setupSubscription = async () => {
      try {
        // ModuleManager를 통해 SectionDBManager 모듈 가져오기
        const SectionDBManager = await ModuleManager.loadGlobalModuleAsync('sectionDBManager');
        if (!SectionDBManager) {
          console.error('[ExploringItemSidebar] SectionDBManager 모듈을 찾을 수 없습니다.');
          return;
        }
        
        console.log('[ExploringItemSidebar] SectionDBManager 구독 설정');
        
        // 기존 구독 해제
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        // 새로운 구독 설정 - 현재 Redux 상태의 섹션명 전달
        unsubscribeRef.current = SectionDBManager.subscribe(
          // 구독 콜백 함수
          (sectionName, items) => {
            console.log(`[ExploringItemSidebar] 구독 콜백: ${sectionName} 섹션 데이터 수신 (${items?.length || 0}개 항목)`);
            
            // 현재 선택된 섹션에 대한 업데이트만 처리
            if (sectionName === curSectionName) {
              setCurItemListInCurSection(items || []);
            }
          },
          // 초기 섹션명 전달 - 현재 Redux 상태의 섹션명 사용
          curSectionName
        );
      } catch (error) {
        console.error('[ExploringItemSidebar] SectionDBManager 구독 설정 중 오류:', error);
      }
    };
    
    setupSubscription();
    
    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      if (unsubscribeRef.current) {
        console.log('[ExploringItemSidebar] SectionDBManager 구독 해제');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [curSectionName]);
  
  // 아이템 리스트가 변경될 때 이미지 props 로드
  useEffect(() => {
    if (!curItemListInCurSection || !curItemListInCurSection.length) return;
    
    // 초기 상태 설정
    const initialLoadingStates = {};
    const initialCurrentIndexes = {};
    
    // 각 아이템별 이미지 리스트 초기화
    curItemListInCurSection.forEach(item => {
      if (item.serverDataset?.id) {
        initialCurrentIndexes[item.serverDataset.id] = 0;
      }
    });
    
    setCurrentImageIndexes(initialCurrentIndexes);
    
    // 각 아이템의 모든 이미지 props 비동기 로드
    const loadAllItemsImageProps = async () => {
      const allItemsImagesProps = {};
      
      for (const item of curItemListInCurSection) {
        if (!item.serverDataset?.id) continue;
        
        const itemId = item.serverDataset.id;
        
        // 아이템의 모든 이미지 목록 가져오기 (메인 이미지 + 추가 이미지)
        const allImages = getAllItemImages(item);
        
        if (allImages.length === 0) continue;
        
        // 이 아이템의 모든 이미지에 대한 props 배열
        const imagesPropsArray = [];
        
        // 각 이미지에 대해 props 생성
        for (const [idx, publicId] of allImages.entries()) {
          if (!publicId || publicId.trim() === '') continue;
          
          initialLoadingStates[publicId] = 'loading';
          
          try {
            const props = await createNextImageProps(publicId, IMAGE_TEMPLATES.BANNER_WIDE, {
              width: 280,
              height: 100,
              alt: `${item.serverDataset.itemName || ''} 이미지`,
              objectFit: 'cover',
              priority: idx === 0, // 첫 번째 이미지는 우선 로드
            });
            
            imagesPropsArray.push({
              imageId: publicId,
              props
            });
            
            // 로딩 상태 업데이트
            initialLoadingStates[publicId] = 'loaded';
          } catch (error) {
            console.error(`[ExploringSidebar] 이미지 props 생성 오류(${publicId}):`, error);
            initialLoadingStates[publicId] = 'error';
          }
        }
        
        if (imagesPropsArray.length > 0) {
          allItemsImagesProps[itemId] = imagesPropsArray;
        }
      }
      
      setItemImagesProps(allItemsImagesProps);
      setImageLoadingStates(initialLoadingStates);
    };
    
    loadAllItemsImageProps();
  }, [curItemListInCurSection]);
  
  
  // 아이템의 모든 이미지 목록 가져오기 (메인 이미지 + 추가 이미지)
  const getAllItemImages = (item) => {
    if (!item.serverDataset) return [];
    
    const images = [];
    
    // 메인 이미지 추가
    if (item.serverDataset.mainImage && item.serverDataset.mainImage.trim() !== '') {
      images.push(item.serverDataset.mainImage);
    }
    
    // subImages 배열 처리 
    if (item.serverDataset.subImages && Array.isArray(item.serverDataset.subImages)) {
      item.serverDataset.subImages.forEach(subImage => {
        if (subImage && subImage.trim() !== '') {
          images.push(subImage);
        }
      });
    }
    
    return images;
  };
  
  // 이미지 로드 성공 핸들러
  const handleImageLoad = (publicId, itemName) => {
    setImageLoadingStates(prev => ({
      ...prev,
      [publicId]: 'loaded'
    }));
  };
  
  // 이미지 로드 실패 핸들러
  const handleImageError = (publicId, itemName, e) => {
    console.error(`[ExploringSidebar] 이미지 로드 실패: ${itemName}`, e);
    setImageLoadingStates(prev => ({
      ...prev,
      [publicId]: 'error'
    }));
    
    // 로드 실패 시 기본 이미지로 대체 (선택적)
    if (e.target) {
      e.target.style.display = 'none';
    }
  };

  // 상점 선택 핸들러
  const handleItemSelect = (item, e) => {
    e.preventDefault();
    
    // 선택된 상점 설정 - 리덕스 액션으로 변경
    const itemId = item.serverDataset?.id;
    if (itemId) {
      dispatch(itemSelectedThunk({
        id: itemId,
        sectionName: curSectionName
      }));
    }
  };

  // 이미지 클릭 핸들러
  const handleImageClick = (e, publicId, itemName) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 이미지가 속한 상점 찾기
    const _shop = curItemListInCurSection.find(_item => 
      (_item.serverDataset?.itemName === itemName) ||
      (_item.itemName === itemName)
    );
    
    if (_shop && _shop.serverDataset?.id) {
      // 상점 선택 - 리덕스 액션으로 변경
      dispatch(itemSelectedThunk({
        id: _shop.serverDataset.id,
        sectionName: curSectionName
      }));
    }
  };
  
  // next 이미지로 이동
  const handleNextImage = (e, itemId) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 해당 아이템의 이미지 props 배열
    const itemImagePropsList = itemImagesProps[itemId];
    if (!itemImagePropsList || itemImagePropsList.length <= 1) {
      return;
    }
    
    // 현재 인덱스
    const currentIndex = currentImageIndexes[itemId] || 0;
    // next 인덱스 (마지막 이미지면 첫 이미지로)
    const nextIndex = (currentIndex + 1) % itemImagePropsList.length;
    
    // 인덱스 업데이트
    setCurrentImageIndexes(prev => ({
      ...prev,
      [itemId]: nextIndex
    }));
  };
  
  // prev 이미지로 이동
  const handlePrevImage = (e, itemId) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 해당 아이템의 이미지 props 배열
    const itemImagePropsList = itemImagesProps[itemId];
    if (!itemImagePropsList || itemImagePropsList.length <= 1) {
      return;
    }
    
    // 현재 인덱스
    const currentIndex = currentImageIndexes[itemId] || 0;
    // prev 인덱스 (첫 이미지면 마지막 이미지로)
    const prevIndex = (currentIndex - 1 + itemImagePropsList.length) % itemImagePropsList.length;
    
    // 인덱스 업데이트
    setCurrentImageIndexes(prev => ({
      ...prev,
      [itemId]: prevIndex
    }));
  };

  // 해당 아이템의 이미지 네비게이팅 렌더링
  const renderItemImageNavigatingItemsection = (item) => {
    if (!item.serverDataset?.id) return null;
    
    const itemId = item.serverDataset.id;
    const imagesProps = itemImagesProps[itemId];
    const currentIndex = currentImageIndexes[itemId] || 0;
    
    // 이미지 props가 없는 경우 로딩 중 표시
    if (!imagesProps || imagesProps.length === 0) {
      return (
        <div className={styles['explSidebar-emptyImagePlaceholder']} style={{ width: '100%', height: 100 }}>
          <span>이미지 로딩 중...</span>
        </div>
      );
    }
    
    return (
      <div className={styles['explSidebar-imageNavigatingItemsection']}>
        {imagesProps.map((imageData, index) => (
          <div 
            key={`img-${itemId}-${index}`}
            className={styles['explSidebar-NavigatingItemsectionItem']}
            style={{ display: index === currentIndex ? 'block' : 'none' }}
          >
            <Image
              {...imageData.props}
              className={styles['explSidebar-NavigatingItemsectionImage']}
              onClick={(e) => handleImageClick(e, imageData.imageId, item.serverDataset.itemName)}
              onLoad={() => handleImageLoad(imageData.imageId, item.serverDataset.itemName)}
              onError={(e) => handleImageError(imageData.imageId, item.serverDataset.itemName, e)}
              data-index={index}
            />
          </div>
        ))}
      </div>
    );
  };

  // 이미지 네비게이팅 인디케이터 표시
  const renderNavigatingItemsectionIndicator = (item) => {
    if (!item.serverDataset?.id) return null;
    
    const itemId = item.serverDataset.id;
    const imagesProps = itemImagesProps[itemId];
    
    // 이미지가 하나뿐이면 인디케이터 표시 안함
    if (!imagesProps || imagesProps.length <= 1) return null;
    
    const currentIndex = currentImageIndexes[itemId] || 0;
    
    return (
      <div className={styles['explSidebar-NavigatingItemsectionIndicator']}>
        <span>{currentIndex + 1} / {imagesProps.length}</span>
      </div>
    );
  };
  
  // 네비게이션 버튼 표시 여부 확인
  const shouldShowNavButtons = (item) => {
    if (!item.serverDataset?.id) return false;
    
    const itemId = item.serverDataset.id;
    const imagesProps = itemImagesProps[itemId];
    
    // 이미지가 두 개 이상인 경우에만 버튼 표시
    return imagesProps && imagesProps.length > 1;
  };

  // 사이드바 토글 핸들러
  const handleToggleSidebar = () => {
    dispatch(toggleSidebarVisibility());
  };
  
  // 섹션 변경 핸들러
  const handleSectionChange = useCallback((newSectionName) => {
    if (newSectionName === curSectionName) return;
    
    // mapEventSlice의 curSectionChangedThunk 사용
    dispatch(curSectionChangedThunk(newSectionName));
  }, [curSectionName, dispatch]);

  // 아이템이 선택되었는지 확인하는 함수 - 리덕스 상태 사용
  const isItemSelected = (item) => {
    if (!highlightedItemId || !item.serverDataset) return false;
    return highlightedItemId === item.serverDataset.id;
  };
  
  // 보기 모드 변경 핸들러
  const handleChangeViewMode = (mode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    // 카드 뷰로 전환 시 시작 인덱스 초기화
    if (mode === 'card') {
      setCardViewStartIndex(0);
    }
  };
  
  // 카드 뷰의 next 페이지로 이동 - 기존 네비게이션 로직과 동일하게 변경
  const handleNextCardPage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 아이템 리스트 길이
    const itemCount = curItemListInCurSection.length;
    // 한 페이지에 표시할 아이템 수
    const itemsPerPage = 3;
    // 최대 시작 인덱스 (페이지네이션의 마지막 페이지)
    const maxStartIndex = Math.max(0, itemCount - itemsPerPage);
    
    // next 시작 인덱스 계산 (한 페이지씩 이동)
    const nextStartIndex = Math.min(cardViewStartIndex + itemsPerPage, maxStartIndex);
    
    setCardViewStartIndex(nextStartIndex);
  };
  
  // 카드 뷰의 prev 페이지로 이동 - 기존 네비게이션 로직과 동일하게 변경
  const handlePrevCardPage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 한 페이지에 표시할 아이템 수
    const itemsPerPage = 3;
    
    // prev 시작 인덱스 계산 (한 페이지씩 이동)
    const prevStartIndex = Math.max(0, cardViewStartIndex - itemsPerPage);
    
    setCardViewStartIndex(prevStartIndex);
  };
  
  // 카드 뷰 네비게이션 버튼 표시 여부 확인
  const shouldShowCardNavButtons = () => {
    return curItemListInCurSection && curItemListInCurSection.length > 3;
  };
  
  // 카드 아이템의 메인 이미지 가져오기
  const getCardMainImage = (item) => {
    if (!item.serverDataset?.id) return null;
    
    const itemId = item.serverDataset.id;
    const imagesProps = itemImagesProps[itemId];
    
    if (!imagesProps || imagesProps.length === 0) {
      return (
        <div className={styles['explSidebar-emptyImagePlaceholder']} style={{ width: '100%', height: 100 }}>
          <span>이미지 로딩 중...</span>
        </div>
      );
    }
    
    const currentIndex = currentImageIndexes[itemId] || 0;
    const imageData = imagesProps[currentIndex];
    
    return (
      <Image
        {...imageData.props}
        className={styles['explSidebar-NavigatingItemsectionImage']}
        onClick={(e) => handleImageClick(e, imageData.imageId, item.serverDataset.itemName)}
        onLoad={() => handleImageLoad(imageData.imageId, item.serverDataset.itemName)}
        onError={(e) => handleImageError(imageData.imageId, item.serverDataset.itemName, e)}
      />
    );
  };
  
  // 카드 뷰 렌더링
  const renderCardView = () => {
    if (!curItemListInCurSection || curItemListInCurSection.length === 0) {
      return (
        <div className={styles['explSidebar-emptyItem']}>
          <span>....</span>
        </div>
      );
    }
    
    // 현재 보이는 아이템 (최대 3개)
    const visibleItems = curItemListInCurSection.slice(cardViewStartIndex, cardViewStartIndex + 3);
    
    // 네비게이션 버튼 표시 여부
    const showNavButtons = shouldShowCardNavButtons();
    // prev 버튼 활성화 여부
    const enablePrevButton = cardViewStartIndex > 0;
    // next 버튼 활성화 여부 (시작 인덱스 + 표시 아이템 수 < 전체 아이템 수)
    const enableNextButton = cardViewStartIndex + 3 < curItemListInCurSection.length;
    
    return (
      <div className={styles['explSidebar-cardView']}>
        {/* prev 버튼 - 기존 이미지 네비게이션 버튼 스타일 재사용 */}
        {showNavButtons && enablePrevButton && (
          <button 
            className={`${styles['explSidebar-imageNavBtn']} ${styles['explSidebar-prevNavBtn']}`}
            onClick={handlePrevCardPage}
            aria-label="prev 페이지"
            style={{ zIndex: 20 }}
          >
            ◀
          </button>
        )}
        
        {/* 카드 아이템 컨테이너 추가 */}
        <div className={styles['explSidebar-cardItemsContainer']}>
          {/* next 버튼 - 기존 이미지 네비게이션 버튼 스타일 재사용 */}
          {showNavButtons && enableNextButton && (
            <button 
              className={`${styles['explSidebar-imageNavBtn']} ${styles['explSidebar-nextNavBtn']}`}
              onClick={handleNextCardPage}
              aria-label="next 페이지"
              style={{ zIndex: 20 }}
            >
              ▶
            </button>
          )}
          {/* 카드 아이템 */}
          {visibleItems.map((item, index) => {
            const isSelected = isItemSelected(item);
            
            return (
              <div 
                key={`card-${index}-${item.serverDataset?.id || index}`} 
                className={isSelected ? styles['explSidebar-selectedCardItem'] : styles['explSidebar-cardItem']}
              >
                <a href="#" onClick={(e) => handleItemSelect(item, e)}>
                  <div className={styles['explSidebar-cardImageContainer']}>
                    {getCardMainImage(item)}
                  </div>
                  <div className={styles['explSidebar-cardDetails']}>
                    <span className={styles['explSidebar-cardTitle']}>
                      {item.serverDataset?.itemName || ''} 
                      {item.serverDataset?.alias && <span> ({item.serverDataset.alias})</span>}
                    </span>
                    <p className={styles['explSidebar-cardComment']}>
                      {item.serverDataset?.comment || ''}
                    </p>
                  </div>
                </a>
              </div>
            );
          })}
        </div>
        
      </div>
    );
  };
  
  // 관광 뷰 렌더링
  const renderTourView = () => {
    if (!curItemListInCurSection || curItemListInCurSection.length === 0) {
      return (
        <div className={styles['explSidebar-emptyItem']}>
          <span>...</span>
        </div>
      );
    }
    
    return (
      <div className={styles['explSidebar-tourView']}>
        {curItemListInCurSection.map((item, index) => {
          const isSelected = isItemSelected(item);
          const itemId = item.serverDataset?.id;
          
          // 이미지 데이터 가져오기
          const imagesProps = itemImagesProps[itemId];
          const currentIndex = currentImageIndexes[itemId] || 0;
          
          // 이미지 요소 생성
          let imageElement;
          if (!imagesProps || imagesProps.length === 0) {
            imageElement = (
              <div className={styles['explSidebar-emptyImagePlaceholder']} style={{ width: '100%', height: '100%' }}>
                <span>이미지 로딩 중...</span>
              </div>
            );
          } else {
            const imageData = imagesProps[currentIndex];
            imageElement = (
              <Image
                {...imageData.props}
                width={88}
                height={88}
                objectFit="cover"
                onClick={(e) => handleImageClick(e, imageData.imageId, item.serverDataset.itemName)}
                onLoad={() => handleImageLoad(imageData.imageId, item.serverDataset.itemName)}
                onError={(e) => handleImageError(imageData.imageId, item.serverDataset.itemName, e)}
              />
            );
          }
          
          return (
            <div 
              key={`tour-${index}-${itemId || index}`} 
              className={isSelected ? styles['explSidebar-selectedTourCard'] : styles['explSidebar-tourCard']}
            >
              <a href="#" onClick={(e) => handleItemSelect(item, e)}>
                <div className={styles['explSidebar-tourCardImage']}>
                  {imageElement}
                </div>
                <div className={styles['explSidebar-tourCardContent']}>
                  <div className={styles['explSidebar-tourCardTitle']}>
                    {item.serverDataset?.itemName || ''}
                  </div>
                  <div className={styles['explSidebar-tourCardSubtitle']}>
                    {item.serverDataset?.alias || ''}
                  </div>
                </div>
              </a>
            </div>
          );
        })}
      </div>
    );
  };
  
  // 리스트 뷰 렌더링
  const renderListView = () => {
    if (!curItemListInCurSection || curItemListInCurSection.length === 0) {
      return (
        <li className={styles['explSidebar-emptyItem']}>
          <span>....</span>
        </li>
      );
    }
    
    return curItemListInCurSection.map((item, index) => {
      return (
        <li 
          key={`shop-${index}-${item.serverDataset.itemName}`} 
          className={isItemSelected(item) ? styles['explSidebar-selectedItem'] : styles['explSidebar-item']}
        >
          <a href="#" onClick={(e) => handleItemSelect(item, e)}>
           
            <div className={styles['explSidebar-imageContainer']}>
              {/* 메인 이미지 */}
              <div className={styles['explSidebar-mainImage']}>
                {/* 이미지 네비게이팅 prev 버튼 - 이미지가 2개 이상일 때만 표시 */}
                {shouldShowNavButtons(item) && (
                  <button 
                    className={styles['explSidebar-imageNavBtn']} 
                    onClick={(e) => {
                      // 이벤트 전파 중지
                      e.preventDefault();
                      e.stopPropagation();
                      handlePrevImage(e, item.serverDataset.id);
                      return false;
                    }}
                    aria-label="prev 이미지"
                    type="button"
                  >
                    ◀
                  </button>
                )}
                
                {/* 이미지 네비게이팅 렌더링 */}
                {renderItemImageNavigatingItemsection(item)}
                
                {/* 이미지 네비게이팅 next 버튼 - 이미지가 2개 이상일 때만 표시 */}
                {shouldShowNavButtons(item) && (
                  <button 
                    className={styles['explSidebar-imageNavBtn']} 
                    onClick={(e) => {
                      // 이벤트 전파 중지
                      e.preventDefault();
                      e.stopPropagation();
                      handleNextImage(e, item.serverDataset.id);
                      return false;
                    }}
                    aria-label="next 이미지"
                    type="button"
                  >
                    ▶
                  </button>
                )}
                
                {/* 네비게이팅 인디케이터 */}
                {renderNavigatingItemsectionIndicator(item)}
              </div>
            </div>
            <div className={styles['explSidebar-itemDetails']}>
              <span className={styles['explSidebar-itemTitle']}>
                {item.serverDataset.itemName || ''} 
                <span className={styles['explSidebar-storeStyle']}>{item.serverDataset.alias || ''}</span>
              </span>
            </div>
            <p className={styles['explSidebar-itemComment']}>
              {item.serverDataset.comment || ''}
            </p>
          </a>
        </li>
      );
    });
  };

  return (
    <div className={`${styles['explSidebar-sidebar']} ${isSidebarVisible ? '' : styles['explSidebar-hidden']}`}>
      <div className={styles['explSidebar-header']}>
        <button className={styles['explSidebar-backButton']} onClick={handleToggleSidebar}>←</button>
        <h1>{curSectionName || '지역 로딩 중'}</h1>
        <button className={styles['explSidebar-iconButton']}>⚙️</button>
      </div>
      <div className={styles['explSidebar-menu']}>
        <button 
          className={styles['explSidebar-menuButton']}
          onClick={() => handleChangeViewMode('list')}
        >
          맛집
        </button>
        <button 
          className={styles['explSidebar-menuButton']}
          onClick={() => handleChangeViewMode('card')}
        >
          test
        </button>
        <button 
          className={styles['explSidebar-menuButton']}
          onClick={() => handleChangeViewMode('tour')}
        >
          관광
        </button>
      </div>
      <div className={styles['explSidebar-itemListContainer']}>
        {viewMode === 'list' ? (
          <ul className={styles['explSidebar-itemList']}>
            {renderListView()}
          </ul>
        ) : viewMode === 'card' ? (
          renderCardView()
        ) : (
          renderTourView()
        )}
      </div>
    </div>
  );
};

export default ExploringItemSidebar; 