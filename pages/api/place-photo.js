/**
 * 구글 Place Photo API 프록시 핸들러
 */
export default async function handler(req, res) {
  const { photo_reference, maxwidth = 400 } = req.query;
  
  if (!photo_reference) {
    return res.status(400).json({ error: '포토 레퍼런스가 필요합니다' });
  }
  
  // 구글 API 키 가져오기 (서버 환경변수 우선, 없으면 클라이언트 환경변수 사용)
  const apiKey = process.env.MAPS_API_KEY || process.env.NEXT_PUBLIC_MAPS_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Maps API 키가 설정되지 않았습니다' });
  }
  
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${photo_reference}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `구글 API 응답 오류: ${response.status}`,
        message: response.statusText
      });
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // 응답 헤더 설정
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24시간 캐싱
    
    // 이미지 데이터 반환
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('이미지 로드 오류:', error);
    res.status(500).json({ error: '이미지 로드에 실패했습니다' });
  }
} 