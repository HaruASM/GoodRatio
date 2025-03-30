import React, { useEffect } from 'react';
import Image from 'next/image';
import styles from './styles.module.css';
import { parseCoordinates } from '../../../lib/models/editorModels'; 

// 하위 폴더에서 ExploringSidebar 컴포넌트를 가져와 내보냅니다
export { default } from './ExploringSidebar'; 