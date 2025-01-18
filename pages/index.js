import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firebasedb } from '../firebase';

export default function Home() {
  const [data, setData] = useState([]);

  useEffect(() => {
    
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(firebasedb, "vehicles"));
        const dataList = querySnapshot.docs.map(doc => ({  id: doc.id, ...doc.data() }));
        setData(dataList);
        
      } catch (e) {
        console.error('Error fetching data: 222', e);
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