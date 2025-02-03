import React from 'react';
import Head from 'next/head';
import styles from './styles.module.css'; // CSS 모듈을 사용하여 스타일링

export default function Shops() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Shops</title>
      </Head>
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <button className={styles.backButton}>←</button>
          <h1>반월당역 관광지도</h1>
          <button className={styles.iconButton}>⚙️</button>
        </div>
        <div className={styles.menu}>
          <button className={styles.menuButton}>숙소</button>
          <button className={styles.menuButton}>맛집</button>
          <button className={styles.menuButton}>관광</button>
        </div>
        <ul className={styles.itemList}>
          <li className={styles.item}>
            <a href="https://example.com">
              <div className={styles.itemDetails}>
                <span className={styles.itemTitle}>남산에 <small>일식당</small></span>
                <p>영업 중 · 20:30에 라스트오더</p>
                <p><strong>380m</strong> · 대구 중구 남산동</p>
              </div>
              <img
                src="https://example.com/image.jpg"
                alt="남산에 일식당"
                className={styles.itemImage}
              />
            </a>
          </li>
          <li className={styles.item}>
            <div className={styles.itemDetails}>
              <span className={styles.itemTitle}>남산에2 <small>일식당</small></span>
              <p>영업 중 · 20:30에 라스트오더</p>
              <p><strong>380m</strong> · 대구 중구 남산동</p>
            </div>
            <img
              src="https://example.com/image.jpg"
              alt="남산에2 일식당"
              className={styles.itemImage}
            />
          </li>
          <li className={styles.item}>
            <div className={styles.itemDetails}>
              <span className={styles.itemTitle}>남산에3 <small>일식당</small></span>
              <p>영업 중 · 20:30에 라스트오더</p>
              <p><strong>380m</strong> · 대구 중구 남산동</p>
            </div>
            <img
              src="https://example.com/image.jpg"
              alt="남산에3 일식당"
              className={styles.itemImage}
            />
          </li>
          <li className={styles.item}>
            <div className={styles.itemDetails}>
              <span className={styles.itemTitle}>남산에4 <small>일식당</small></span>
              <p>영업 중 · 20:30에 라스트오더</p>
              <p><strong>380m</strong> · 대구 중구 남산동</p>
            </div>
            <img
              src="https://example.com/image.jpg"
              alt="남산에4 일식당"
              className={styles.itemImage}
            />
          </li>
        </ul>
      </div>
      <div className={styles.map}>
        {/* 구글 지도가 여기에 표시됩니다 */}
        <p>Google Map will be here</p>
      </div>
    </div>
  );
} 