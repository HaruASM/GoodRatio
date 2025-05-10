import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firebasedb } from '../firebase';
import Link from 'next/link';
import styles from './index.module.css';

// 내부 컴포넌트 정의
function HomeComponent() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(firebasedb, "vehicles"));
        const dataList = querySnapshot.docs.map(doc => ({  id: doc.id, ...doc.data() }));
        setData(dataList);
      } catch (e) {
        console.error('Error fetching data: ', e);
      }
    };

    fetchData();
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>GoodRatio</h1>
      
      <div className={styles.navigation}>
        <Link href="/editor">
          <div className={styles.navCard}>
            <h2>에디터 페이지</h2>
            <p>상점 데이터 관리 및 편집</p>
          </div>
        </Link>
        
        <Link href="/browser">
          <div className={styles.navCard}>
            <h2>투어링 페이지</h2>
            <p>맵 뷰 탐색 및 조회</p>
          </div>
        </Link>
      </div>
      
      <div className={styles.dataSection}>
        <h3>데이터 목록</h3>
        <ul>
          {data.map(item => (
            <li key={item.id}>{JSON.stringify(item.vehicle)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// 동적 임포트 (SSR 비활성화)
const DynamicHomeComponent = dynamic(
  () => Promise.resolve(HomeComponent), 
  { 
    ssr: false, 
    loading: () => <div>로딩 중...</div> 
  }
);

export default function Home() {
  return <DynamicHomeComponent />;
} 