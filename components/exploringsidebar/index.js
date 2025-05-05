import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSelector, useDispatch } from 'react-redux';
import styles from './stylesExploringsidebar.module.css';
import { 
  IMAGE_TEMPLATES, 
  createNextImageProps 
} from '../../lib/utils/imageHelpers';
import { 
  itemSelectedThunk
} from '../../lib/store/slices/mapEventSlice';
import {
  selectHighlightedItemId,
  selectIsSidebarVisible,
  toggleSidebarVisibility
} from '../../lib/store/slices/exploringSidebarSlice';

/**
 * 좌측 사이드바 컴포넌트
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.curSectionName - 현재 선택된 섹션명
 * @param {Array} props.curItemListInCurSection - 현재 섹션의 아이템 리스트
 * @returns {React.ReactElement} 좌측 사이드바 컴포넌트
 */
const ExploringSidebar = ({
  curSectionName,
  curItemListInCurSection
}) => {
  // Redux 상태 및 디스패치 가져오기
  const dispatch = useDispatch();
  const highlightedItemId = useSelector(selectHighlightedItemId);
  const isSidebarVisible = useSelector(selectIsSidebarVisible);
  
  // 이미지 props 관리를 위한 상태 추가
  const [itemImagesProps, setItemImagesProps] = useState({});
  // 이미지 로딩 상태 관리
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  // 각 아이템별 현재 표시중인 이미지 인덱스 관리
  const [currentImageIndexes, setCurrentImageIndexes] = useState({});
  
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
  
  // 다음 이미지로 이동
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
    // 다음 인덱스 (마지막 이미지면 첫 이미지로)
    const nextIndex = (currentIndex + 1) % itemImagePropsList.length;
    
    // 인덱스 업데이트
    setCurrentImageIndexes(prev => ({
      ...prev,
      [itemId]: nextIndex
    }));
  };
  
  // 이전 이미지로 이동
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
    // 이전 인덱스 (첫 이미지면 마지막 이미지로)
    const prevIndex = (currentIndex - 1 + itemImagePropsList.length) % itemImagePropsList.length;
    
    // 인덱스 업데이트
    setCurrentImageIndexes(prev => ({
      ...prev,
      [itemId]: prevIndex
    }));
  };

  // 해당 아이템의 이미지 갤러리 렌더링
  const renderItemImageGallery = (item) => {
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
      <div className={styles['explSidebar-imageGallery']}>
        {imagesProps.map((imageData, index) => (
          <div 
            key={`img-${itemId}-${index}`}
            className={styles['explSidebar-galleryItem']}
            style={{ display: index === currentIndex ? 'block' : 'none' }}
          >
            <Image
              {...imageData.props}
              className={styles['explSidebar-galleryImage']}
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

  // 이미지 갤러리 인디케이터 표시
  const renderGalleryIndicator = (item) => {
    if (!item.serverDataset?.id) return null;
    
    const itemId = item.serverDataset.id;
    const imagesProps = itemImagesProps[itemId];
    
    // 이미지가 하나뿐이면 인디케이터 표시 안함
    if (!imagesProps || imagesProps.length <= 1) return null;
    
    const currentIndex = currentImageIndexes[itemId] || 0;
    
    return (
      <div className={styles['explSidebar-galleryIndicator']}>
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

  // 아이템이 선택되었는지 확인하는 함수 - 리덕스 상태 사용
  const isItemSelected = (item) => {
    if (!highlightedItemId || !item.serverDataset) return false;
    return highlightedItemId === item.serverDataset.id;
  };

  return (
    <div className={`${styles['explSidebar-sidebar']} ${isSidebarVisible ? '' : styles['explSidebar-hidden']}`}>
      <div className={styles['explSidebar-header']}>
        <button className={styles['explSidebar-backButton']} onClick={handleToggleSidebar}>←</button>
        <h1>{curSectionName || '지역 로딩 중'}</h1>
        <button className={styles['explSidebar-iconButton']}>⚙️</button>
      </div>
      <div className={styles['explSidebar-menu']}>
        <button className={styles['explSidebar-menuButton']}>숙소</button>
        <button className={styles['explSidebar-menuButton']}>맛집</button>
        <button className={styles['explSidebar-menuButton']}>관광</button>
        <button className={styles['explSidebar-menuButton']}>환전</button>
      </div>
      <ul className={styles['explSidebar-itemList']}>
        {curItemListInCurSection.length > 0 ? (
          curItemListInCurSection.map((item, index) => {
            return (
              <li 
                key={`shop-${index}-${item.serverDataset.itemName}`} 
                className={isItemSelected(item) ? styles['explSidebar-selectedItem'] : styles['explSidebar-item']}
              >
                <a href="#" onClick={(e) => handleItemSelect(item, e)}>
                 
                  <div className={styles['explSidebar-imageContainer']}>
                    {/* 메인 이미지 */}
                    <div className={styles['explSidebar-mainImage']}>
                      {/* 이미지 갤러리 이전 버튼 - 이미지가 2개 이상일 때만 표시 */}
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
                          aria-label="이전 이미지"
                          type="button"
                        >
                          ◀
                        </button>
                      )}
                      
                      {/* 이미지 갤러리 렌더링 */}
                      {renderItemImageGallery(item)}
                      
                      {/* 이미지 갤러리 다음 버튼 - 이미지가 2개 이상일 때만 표시 */}
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
                          aria-label="다음 이미지"
                          type="button"
                        >
                          ▶
                        </button>
                      )}
                      
                      {/* 갤러리 인디케이터 */}
                      {renderGalleryIndicator(item)}
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
          })
        ) : (
          <li className={styles['explSidebar-emptyItem']}>
            <span>항목이 없습니다.</span>
          </li>
        )}
      </ul>
    </div>
  );
};

export default ExploringSidebar; 