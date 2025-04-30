import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSelector, useDispatch } from 'react-redux';
import styles from './styles.module.css';
import { parseCoordinates } from '../../lib/models/editorModels';
import { 
  createTemplateImageProps, 
  IMAGE_TEMPLATES, 
  createCrossOriginImageProps,
  createNextImageProps 
} from '../../lib/utils/imageHelpers';
import { 
  itemSelectedThunk, 
  selectSelectedItemId 
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
  const [imageProps, setImageProps] = useState({});
  // 이미지 로딩 상태 관리
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  
  // 아이템 리스트가 변경될 때 이미지 props 로드
  useEffect(() => {
    if (!curItemListInCurSection || !curItemListInCurSection.length) return;
    
    // 각 아이템의 메인 이미지 props 로드
    const loadImageProps = async () => {
      
      // 로딩 상태 초기화
      const initialLoadingStates = {};
      curItemListInCurSection.forEach(item => {
        if (item.serverDataset?.mainImage) {
          initialLoadingStates[item.serverDataset.mainImage] = 'loading';
        }
      });
      setImageLoadingStates(initialLoadingStates);
      
      const propsPromises = curItemListInCurSection.map(async (item) => {
        if (!item.serverDataset || !item.serverDataset.mainImage) return null;
        
        const publicId = item.serverDataset.mainImage;
        if (!publicId || publicId.trim() === '') return null;
        
        try {
          
          // createNextImageProps 함수 사용 (비동기)
          const props = await createNextImageProps(publicId, IMAGE_TEMPLATES.BANNER_WIDE, {
            width: 280,
            height: 120,
            alt: `${item.serverDataset.itemName || ''} 메인 이미지`,
            objectFit: 'cover'
          });
          
          return [publicId, props];
        } catch (error) {
          console.error('[ExploringSidebar] 이미지 props 생성 오류:', error);
          // 로딩 상태 업데이트
          setImageLoadingStates(prev => ({
            ...prev,
            [publicId]: 'error'
          }));
          return null;
        }
      });
      
      const propsEntries = (await Promise.all(propsPromises)).filter(Boolean);
      
      if (propsEntries.length > 0) {
        const newImageProps = Object.fromEntries(propsEntries);
        
        setImageProps(newImageProps);
        
        // 로딩 상태 업데이트
        const loadedStates = {};
        propsEntries.forEach(([publicId]) => {
          loadedStates[publicId] = 'loaded';
        });
        setImageLoadingStates(prev => ({
          ...prev,
          ...loadedStates
        }));
      }
    };
    
    loadImageProps();
  }, [curItemListInCurSection]);
  
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
    } else {
      console.warn(`상점을 찾을 수 없습니다: ${itemName}`);
    }
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
          curItemListInCurSection.map((item, index) => (
            <li 
              key={`shop-${index}-${item.serverDataset.itemName}`} 
              className={isItemSelected(item) ? styles['explSidebar-selectedItem'] : styles['explSidebar-item']}
            >
              <a href="#" onClick={(e) => handleItemSelect(item, e)}>
                <div className={styles['explSidebar-itemDetails']}>
                  <span className={styles['explSidebar-itemTitle']}>
                    {item.serverDataset.itemName || ''} 
                    <span className={styles['explSidebar-storeStyle']}>{item.serverDataset.alias || ''}</span>
                  </span>
                </div>
                <div className={styles['explSidebar-imageContainer']}>
                  {/* 메인 이미지 */}
                  {item.serverDataset.mainImage && item.serverDataset.mainImage.trim() !== '' ? (
                    <div className={styles['explSidebar-mainImage']}>
                      {imageProps[item.serverDataset.mainImage] ? (
                        <Image
                          {...imageProps[item.serverDataset.mainImage]}
                          onClick={(e) => handleImageClick(e, item.serverDataset.mainImage, item.serverDataset.itemName)}
                          onLoad={() => handleImageLoad(item.serverDataset.mainImage, item.serverDataset.itemName)}
                          onError={(e) => handleImageError(item.serverDataset.mainImage, item.serverDataset.itemName, e)}
                        />
                      ) : (
                        <div className={styles['explSidebar-emptyImagePlaceholder']} style={{ width: '100%', height: 120 }}>
                          <span>
                            {imageLoadingStates[item.serverDataset.mainImage] === 'error' 
                              ? '이미지 로드 실패' 
                              : '...'}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles['explSidebar-mainImage']}>
                      <div className={styles['explSidebar-emptyImagePlaceholder']} style={{ width: '100%', height: 120 }}></div>
                    </div>
                  )}
                </div>
                <p className={styles['explSidebar-itemComment']}>
                  {item.serverDataset.comment || ''}
                </p>
              </a>
            </li>
          ))
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