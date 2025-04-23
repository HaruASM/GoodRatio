/**
 * 구글 이미지 프록시 API
 * 
 * 구글 Place Photos API를 통해 이미지를 요청하고 그 결과를 클라이언트에게 반환합니다.
 * 이 프록시 사용의 장점:
 * 1. API 키를 클라이언트에 노출하지 않음
 * 2. CORS 문제 방지
 * 3. 요청 제한 및 로깅 가능
 * 
 * 사용법: /api/image-proxy?photo_reference=REFERENCE&maxwidth=WIDTH&maxheight=HEIGHT
 */

import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // GET 요청만 허용
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { photo_reference, maxwidth = 400, maxheight } = req.query;

  // photo_reference 필수 검증
  if (!photo_reference) {
    return res.status(400).json({ error: 'photo_reference parameter is required' });
  }

  // API 키 가져오기
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key is not configured' });
  }

  try {
    // 구글 Place Photos API URL 구성
    let placesApiUrl = `https://maps.googleapis.com/maps/api/place/photo?photoreference=${encodeURIComponent(photo_reference)}&key=${apiKey}&maxwidth=${maxwidth}`;
    
    // maxheight 파라미터가 있으면 추가
    if (maxheight) {
      placesApiUrl += `&maxheight=${maxheight}`;
    }

    // 구글 API에 요청
    const response = await fetch(placesApiUrl);
    
    // 오류 처리
    if (!response.ok) {
      console.error(`Google API 오류: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: 'Failed to fetch image from Google API',
        status: response.status,
        message: response.statusText
      });
    }

    // 구글 응답의 헤더 가져오기
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    // 이미지 데이터 가져오기
    const imageBuffer = await response.buffer();

    // 응답 헤더 설정
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    // 캐싱 설정 (24시간)
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    // 이미지 데이터 응답
    res.status(200).send(imageBuffer);
  } catch (error) {
    console.error('이미지 프록시 오류:', error);
    res.status(500).json({ error: 'Failed to proxy image', message: error.message });
  }
} 