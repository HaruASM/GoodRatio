import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firebasedb } from '../firebase';

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
    <div>
      <h1>Welcome to the Home Page</h1>
      <ul>
        {data.map(item => (
          <li key={item.id}>{JSON.stringify(item.vehicle)}</li>
        ))}
      </ul>
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