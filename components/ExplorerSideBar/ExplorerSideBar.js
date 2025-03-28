import React from 'react';
import styles from './ExplorerSideBar.module.css';

const ExplorerSideBar = ({ items = [], selectedItemId, onItemSelect, onToggleSidebar }) => {
  return (
    <div className={styles.sidebar}>
      {/* 헤더 및 메뉴 추가 */}
      <div className={styles.header}>
        {/* 뒤로가기 버튼에 onToggleSidebar 연결 (prop이 전달된 경우에만 렌더링하거나 다른 동작 처리) */}
        {onToggleSidebar && 
          <button className={styles.backButton} onClick={onToggleSidebar}>←</button>
        }
        <h1>반월당역</h1> {/* 제목 복구 */}
        <button className={styles.iconButton}>⚙️</button> {/* 설정 버튼 복구 */}
      </div>
      <div className={styles.menu}>
        <button className={styles.menuButton}>숙소</button>
        <button className={styles.menuButton}>맛집</button>
        <button className={styles.menuButton}>관광</button>
        {/* '환전' 버튼이 있었는지 확인 필요, 일단 추가 */}
        <button className={styles.menuButton}>환전</button> 
      </div>
      
      <ul className={styles.itemList}>
        {items.map((item, index) => {
          // 각 아이템의 고유 ID를 결정합니다.
          // serverDataset.place_id를 우선 사용하고, 없으면 index를 fallback으로 사용합니다.
          const itemId = item.serverDataset?.place_id || `item-${index}`; // index를 fallback key로 사용
          const isSelected = selectedItemId === itemId;
          
          // 클릭 핸들러
          const handleClick = (e) => {
            e.preventDefault();
            if (onItemSelect) {
              onItemSelect(item);
            }
          };
          
          return (
            <li 
              key={itemId} 
              className={isSelected ? styles.selectedItem : styles.item}
            >
              <a href="#" onClick={handleClick}>
                <div className={styles.itemDetails}>
                  <span className={styles.itemTitle}>
                    {item.serverDataset?.storeName || '이름 없음'} <small>{item.serverDataset?.storeStyle || ''}</small>
                  </span>
                  {/* 필요에 따라 영업시간, 주소 등 추가 */}
                  <p>
                    {item.serverDataset?.address || '주소 없음'}
                  </p>
                </div>
                {/* 이미지 소스 로직 변경 */}
                <img 
                  src={
                    item.serverDataset?.mainImage || // 1. mainImage 시도
                    item.serverDataset?.subImages?.[0] || // 2. subImages[0] 시도 (URL이라고 가정)
                    'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==' // 3. 기본 Data URL
                  }
                  alt={`${item.serverDataset?.storeName || ''} ${item.serverDataset?.storeStyle || ''}`}
                  className={styles.itemImage}
                  width={80} 
                  height={80} 
                  onError={(e) => {
                    // 현재 src가 이미 fallback Data URL이면 더 이상 변경하지 않음
                    const fallbackSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
                    if (e.target.src !== fallbackSrc) {
                      e.target.src = fallbackSrc;
                    }
                  }}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ExplorerSideBar; 