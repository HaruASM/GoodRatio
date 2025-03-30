import React, { useEffect } from 'react';
import Image from 'next/image';
import styles from './styles.module.css';
import { parseCoordinates } from '../../lib/models/editorModels';
import { getProxiedPhotoUrl } from '../../lib/utils/imageHelpers';

/**
 * 좌측 사이드바 컴포넌트
 * @param {Object} props - 컴포넌트 props
 * @param {boolean} props.isSidebarVisible - 사이드바 가시성 상태
 * @param {Function} props.toggleSidebar - 사이드바 토글 함수
 * @param {string} props.curSectionName - 현재 선택된 섹션명
 * @param {Array} props.curItemListInCurSection - 현재 섹션의 아이템 리스트
 * @param {Function} props.setCurSelectedShop - 선택된 상점 설정 함수
 * @param {Object} props.instMap - 구글 맵 인스턴스
 * @param {Object} props.curSelectedShop - 현재 선택된 상점
 * @returns {React.ReactElement} 좌측 사이드바 컴포넌트
 */
const ExploringSidebar = ({
  isSidebarVisible,
  toggleSidebar,
  curSectionName,
  curItemListInCurSection,
  setCurSelectedShop,
  instMap,
  curSelectedShop
}) => {
  // 상점 선택 핸들러
  const handleShopSelect = (item, e) => {
    e.preventDefault();
    
    // 선택된 상점 설정
    setCurSelectedShop(item);
    
    // 지도 이동
    if (instMap) {
      try {
        let position = null;
        if (item.serverDataset.pinCoordinates) {
          position = parseCoordinates(item.serverDataset.pinCoordinates);
        }

        if (position) {
          instMap.setCenter(position);
          instMap.setZoom(18);
        }
      } catch (error) {
        console.error('지도 이동 중 오류 발생:', error);
      }
    }
  };

  // 이미지 클릭 핸들러
  const handleImageClick = (e, photoReference, itemName) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('이미지 클릭:', { photoReference, itemName });
  };

  // 아이템이 선택되었는지 확인하는 함수
  const isItemSelected = (item) => {
    if (!curSelectedShop) return false;
    
    const selectedName = curSelectedShop.serverDataset ? 
      curSelectedShop.serverDataset.storeName : 
      curSelectedShop.storeName;
      
    const itemName = item.serverDataset ? 
      item.serverDataset.storeName : 
      item.storeName;
      
    return selectedName === itemName;
  };

  return (
    <div className={`${styles.sidebar} ${isSidebarVisible ? '' : styles.hidden}`}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={toggleSidebar}>←</button>
        <h1>{curSectionName || '지역 로딩 중'}</h1>
        <button className={styles.iconButton}>⚙️</button>
      </div>
      <div className={styles.menu}>
        <button className={styles.menuButton}>숙소</button>
        <button className={styles.menuButton}>맛집</button>
        <button className={styles.menuButton}>관광</button>
        <button className={styles.menuButton}>환전</button>
      </div>
      <ul className={styles.itemList}>
        {curItemListInCurSection.length > 0 ? (
          curItemListInCurSection.map((item, index) => (
            <li 
              key={`shop-${index}-${item.serverDataset.storeName}`} 
              className={isItemSelected(item) ? styles.selectedItem : styles.item}
            >
              <a href="#" onClick={(e) => handleShopSelect(item, e)}>
                <div className={styles.itemDetails}>
                  <span className={styles.itemTitle}>
                    {item.serverDataset.storeName || ''} 
                    <small>{item.serverDataset.alias || ''}</small>
                  </span>
                  <p className={styles.itemComment}>
                    {item.serverDataset.comment || ''}
                  </p>
                </div>
                <div className={styles.imageContainer}>
                  {/* 메인 이미지 */}
                  {item.serverDataset.mainImage && item.serverDataset.mainImage.trim() !== '' ? (
                    <div className={styles.mainImage}>
                      <Image
                        src={getProxiedPhotoUrl(item.serverDataset.mainImage, 400)}
                        alt={`${item.serverDataset.storeName || ''} 메인 이미지`}
                        width={120}
                        height={120}
                        unoptimized={true}
                        priority
                        onClick={(e) => handleImageClick(e, item.serverDataset.mainImage, item.serverDataset.storeName)}
                      />
                    </div>
                  ) : (
                    <div className={styles.mainImage}>
                      <div className={styles.emptyImagePlaceholder} style={{ width: 120, height: 120 }}></div>
                    </div>
                  )}
                  {/* 서브 이미지 */}
                  {item.serverDataset.subImages && item.serverDataset.subImages.length > 0 && (
                    <div className={styles.subImages}>
                      {item.serverDataset.subImages.slice(0, 3).map((subImage, imgIndex) => (
                        <div key={imgIndex} className={styles.subImage}>
                          {subImage && subImage.trim() !== '' ? (
                            <Image
                              src={getProxiedPhotoUrl(subImage, 200)}
                              alt={`${item.serverDataset.storeName || ''} 서브 이미지 ${imgIndex + 1}`}
                              width={80}
                              height={80}
                              unoptimized={true}
                              onClick={(e) => handleImageClick(e, subImage, item.serverDataset.storeName)}
                            />
                          ) : (
                            <div className={styles.emptyImagePlaceholder} style={{ width: 80, height: 80 }}></div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </a>
            </li>
          ))
        ) : (
          <li className={styles.item}>
            <a href="#">
              <div className={styles.itemDetails}>
                <span className={styles.itemTitle}>데이터 로딩 중...</span>
                <p>지역 정보를 불러오는 중입니다.</p>
              </div>
            </a>
          </li>
        )}
      </ul>
    </div>
  );
};

export default ExploringSidebar; 