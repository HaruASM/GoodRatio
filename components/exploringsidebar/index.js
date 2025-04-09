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
    
    // 이미지가 속한 상점 찾기
    const shop = curItemListInCurSection.find(item => 
      (item.serverDataset?.itemName === itemName) ||
      (item.itemName === itemName)
    );
    
    if (shop) {
      // 상점 선택 - 기존 handleShopSelect 로직과 동일
      setCurSelectedShop(shop);
      
      // 지도 이동
      if (instMap) {
        try {
          let position = null;
          if (shop.serverDataset?.pinCoordinates) {
            position = parseCoordinates(shop.serverDataset.pinCoordinates);
          } else if (shop.pinCoordinates) {
            position = parseCoordinates(shop.pinCoordinates);
          }

          if (position) {
            instMap.setCenter(position);
            instMap.setZoom(18);
          }
        } catch (error) {
          console.error('지도 이동 중 오류 발생:', error);
        }
      }
    } else {
      console.warn(`상점을 찾을 수 없습니다: ${itemName}`);
    }
  };

  // 아이템이 선택되었는지 확인하는 함수
  const isItemSelected = (item) => {
    if (!curSelectedShop) return false;
    
    const selectedName = curSelectedShop.serverDataset ? 
      curSelectedShop.serverDataset.itemName : 
      curSelectedShop.itemName;
      
    const itemName = item.serverDataset ? 
      item.serverDataset.itemName : 
      item.itemName;
      
    return selectedName === itemName;
  };

  return (
    <div className={`${styles['explSidebar-sidebar']} ${isSidebarVisible ? '' : styles['explSidebar-hidden']}`}>
      <div className={styles['explSidebar-header']}>
        <button className={styles['explSidebar-backButton']} onClick={toggleSidebar}>←</button>
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
              <a href="#" onClick={(e) => handleShopSelect(item, e)}>
                <div className={styles['explSidebar-itemDetails']}>
                  <span className={styles['explSidebar-itemTitle']}>
                    {item.serverDataset.itemName || ''} 
                    <span className={styles['explSidebar-storeStyle']}>{item.serverDataset.storeStyle || ''}</span>
                  </span>
                </div>
                <div className={styles['explSidebar-imageContainer']}>
                  {/* 메인 이미지 */}
                  {item.serverDataset.mainImage && item.serverDataset.mainImage.trim() !== '' ? (
                    <div className={styles['explSidebar-mainImage']}>
                      <Image
                        src={getProxiedPhotoUrl(item.serverDataset.mainImage, 400)}
                        alt={`${item.serverDataset.itemName || ''} 메인 이미지`}
                        fill
                        sizes="280px"
                        style={{ objectFit: 'cover' }}
                        unoptimized={true}
                        priority
                        onClick={(e) => handleImageClick(e, item.serverDataset.mainImage, item.serverDataset.itemName)}
                      />
                    </div>
                  ) : (
                    <div className={styles['explSidebar-mainImage']}>
                      <div className={styles['explSidebar-emptyImagePlaceholder']} style={{ width: '100%', height: 160 }}></div>
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
          <li className={styles['explSidebar-item']}>
            <a href="#">
              <div className={styles['explSidebar-itemDetails']}>
                <span className={styles['explSidebar-itemTitle']}>데이터 로딩 중...</span>
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