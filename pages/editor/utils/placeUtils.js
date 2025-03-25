import { protoServerDataset } from '../dataModels';

/**
 * 구글 Place API로부터 받은 장소 데이터를 앱에서 사용하는 형식으로 직렬화
 * @param {Object} detailPlace - 구글 Place API 응답 객체
 * @param {string} apiKey - 구글 Maps API 키 (이미지 URL 생성용)
 * @returns {Object} 직렬화된 장소 데이터
 */
export const serializeGooglePlaceData = (detailPlace, apiKey) => {
  if (!detailPlace || !detailPlace.geometry || !detailPlace.geometry.location) {
    // console.error("유효하지 않은 구글 Place 데이터");
    return null;
  }
  
  // Google 원본 Photos 객체 디버깅
  if (detailPlace.photos) {
    // console.log('원본 구글 사진 객체 존재, 개수:', detailPlace.photos.length);
    if (detailPlace.photos[0]) {
      // console.log('첫번째 사진 객체 내용:', detailPlace.photos[0]);
      // 프로토타입 체인 검사
      // console.log('첫번째 사진 프로토타입:', Object.getPrototypeOf(detailPlace.photos[0]));
      // 함수 목록 검사
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(detailPlace.photos[0]));
      // console.log('사진 객체 메서드 목록:', methods);
    }
  } else {
    // console.log('원본 구글 사진 객체 없음');
  }
  
  // 사진 객체 처리를 위한 직렬화 로직 추가
  let serializedPhotos = [];
  if (detailPlace.photos && detailPlace.photos.length > 0) {
    serializedPhotos = detailPlace.photos.map((photo, index) => {
      // 객체의 모든 속성 확인
      // console.log(`사진 객체 ${index}의 모든 속성:`, Object.getOwnPropertyNames(photo));
      
      // 사진 URL 생성 시도
      let photoUrl = ''; // photoUrl 변수 선언 및 초기화
      
      try {
        // 메서드 호출 테스트 1: getUrl
        if (typeof photo.getUrl === 'function') {
          const originalUrl = photo.getUrl({ maxWidth: 400, maxHeight: 300 });
          // console.log(`원본 getUrl ${index}:`, originalUrl);
          
          // Places JavaScript API URL을 Places REST API 형식으로 완전히 재구성
          // 예: maxwidth=400&photoreference=REF&key=KEY
          const photoRef = originalUrl.match(/1s([^&]+)/);
          if (photoRef && photoRef[1]) {
            photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef[1]}&key=${apiKey}`;
            // console.log(`getUrl 변환 결과 ${index} [변환 전]:`, originalUrl.substring(0, 100) + '...');
            // console.log(`getUrl 변환 결과 ${index} [변환 후]:`, photoUrl);
          } else {
            // console.error(`getUrl에서 photo_reference를 추출할 수 없음 ${index}`, originalUrl.substring(0, 100) + '...');
            photoUrl = originalUrl; // 원본 URL 유지
          }
        } else {
          // console.log(`getUrl이 함수가 아님 ${index}`);
        }
      } catch (error) {
        // console.error(`getUrl 호출 오류 ${index}:`, error);
      }
      
      // 메서드 2: 다른 메서드 이름 찾기
      try {
        // 객체에서 사용 가능한 모든 메서드 찾기
        const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(photo))
          .filter(prop => typeof photo[prop] === 'function');
        // console.log(`사진 객체 ${index}의 사용 가능한 메서드:`, methodNames);
        
        // URL 관련 가능성이 있는 메서드 찾기
        const urlMethods = methodNames.filter(name => 
          name.toLowerCase().includes('url') || 
          name.toLowerCase().includes('image') || 
          name.toLowerCase().includes('photo')
        );
        // console.log(`잠재적 URL 관련 메서드 ${index}:`, urlMethods);
      } catch (error) {
        // console.error(`메서드 찾기 오류 ${index}:`, error);
      }
      
      return {
        photo_reference: photo.photo_reference,
        getUrl: photoUrl, // getUrl 메서드 결과를 저장
        height: photo.height,
        width: photo.width,
        html_attributions: photo.html_attributions,
        // 전체 객체의 속성을 복사
        allProps: { ...photo }
      };
    });
  }
  
  return {
    ...detailPlace,
    geometry: detailPlace.geometry ? {
      ...detailPlace.geometry,
      location: detailPlace.geometry.location ? {
        lat: typeof detailPlace.geometry.location.lat === 'function' ? 
             detailPlace.geometry.location.lat() : detailPlace.geometry.location.lat,
        lng: typeof detailPlace.geometry.location.lng === 'function' ? 
             detailPlace.geometry.location.lng() : detailPlace.geometry.location.lng
      } : null,
      viewport: detailPlace.geometry.viewport ? {
        northeast: {
          lat: typeof detailPlace.geometry.viewport.getNorthEast().lat === 'function' ? 
               detailPlace.geometry.viewport.getNorthEast().lat() : 
               detailPlace.geometry.viewport.getNorthEast().lat,
          lng: typeof detailPlace.geometry.viewport.getNorthEast().lng === 'function' ? 
               detailPlace.geometry.viewport.getNorthEast().lng() : 
               detailPlace.geometry.viewport.getNorthEast().lng
        },
        southwest: {
          lat: typeof detailPlace.geometry.viewport.getSouthWest().lat === 'function' ? 
               detailPlace.geometry.viewport.getSouthWest().lat() : 
               detailPlace.geometry.viewport.getSouthWest().lat,
          lng: typeof detailPlace.geometry.viewport.getSouthWest().lng === 'function' ? 
               detailPlace.geometry.viewport.getSouthWest().lng() : 
               detailPlace.geometry.viewport.getSouthWest().lng
        }
      } : null
    } : null,
    opening_hours: detailPlace.opening_hours ? {
      weekday_text: detailPlace.opening_hours.weekday_text || []
    } : null,
    // serializedPhotos를 사용하고 기존 중복된 photos 매핑 제거
    photos: serializedPhotos
  };
};

/**
 * 구글 장소 데이터를 앱 서버 데이터셋 형식으로 변환
 * @param {Object} serializedPlace - 직렬화된 구글 Place 데이터
 * @param {string} apiKey - 구글 Maps API 키 (이미지 URL 생성용)
 * @returns {Object} 앱 형식의 서버 데이터셋
 */
export const convertGooglePlaceToServerDataset = (serializedPlace, apiKey) => {
  if (!serializedPlace) return null;
  
  // 기본 서버 데이터셋 템플릿 복사
  const convertedData = { ...protoServerDataset };
  
  // 기본 필드 매핑
  convertedData.storeName = serializedPlace.name || '';
  convertedData.address = serializedPlace.formatted_address || '';
  convertedData.googleDataId = serializedPlace.place_id || '';
  
  // 연락처 정보 (있는 경우)
  if (serializedPlace.formatted_phone_number) {
    convertedData.contact = serializedPlace.formatted_phone_number;
  }
  
  // 웹사이트 정보 (있는 경우)
  if (serializedPlace.website) {
    convertedData.website = serializedPlace.website;
  }
  
  // 영업시간 처리 (주간 영업시간 텍스트 배열)
  if (serializedPlace.opening_hours && serializedPlace.opening_hours.weekday_text) {
    convertedData.businessHours = serializedPlace.opening_hours.weekday_text;
  }
          
  // 좌표 처리
  if (serializedPlace.geometry && serializedPlace.geometry.location) {
    const { lat, lng } = serializedPlace.geometry.location;
    convertedData.pinCoordinates = `${lat},${lng}`;
  }
  
  // 구글 장소의 이미지 처리
  if (serializedPlace.photos && serializedPlace.photos.length > 0) {
    // 디버깅: photo 객체 상세 검사
    // console.log('서버데이터셋 변환 - 사진 데이터:', serializedPlace.photos[0]);
    
    // 첫 번째 이미지를 메인 이미지로 사용
    if (serializedPlace.photos[0]) {
      // getUrl 속성이 있으면 우선 사용 - 직렬화 과정에서 이미 적절히 변환된 URL임
      if (serializedPlace.photos[0].getUrl) {
        convertedData.mainImage = serializedPlace.photos[0].getUrl;
        // console.log('메인 이미지에 getUrl 사용:', convertedData.mainImage);
      } 
      // photo_reference가 있으면 API 호출 URL 생성
      else if (serializedPlace.photos[0].photo_reference) {
        convertedData.mainImage = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${serializedPlace.photos[0].photo_reference}&key=${apiKey}`;
        // console.log('메인 이미지에 photo_reference 사용:', convertedData.mainImage);
      }
      else {
        // console.log('메인 이미지 URL 생성 실패 - photo_reference와 getUrl 모두 없음');
        // 디버깅을 위해 전체 photo 객체 출력
        // console.log('메인 이미지 객체 전체:', JSON.stringify(serializedPlace.photos[0]));
      }
    }
    
    // 나머지 이미지를 서브 이미지로 사용
    if (serializedPlace.photos.length > 1) {
      convertedData.subImages = serializedPlace.photos.slice(1).map((photo, index) => {
        // getUrl 속성이 있으면 우선 사용 - 직렬화 과정에서 이미 적절히 변환된 URL임
        if (photo.getUrl) {
          // console.log(`서브 이미지 ${index}에 getUrl 사용`);
          return photo.getUrl;
        } 
        // photo_reference가 있으면 API 호출 URL 생성
        else if (photo.photo_reference) {
          // console.log(`서브 이미지 ${index}에 photo_reference 사용`);
          return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${apiKey}`;
        }
        else {
          // console.log(`서브 이미지 ${index} URL 생성 실패 - photo_reference와 getUrl 모두 없음`);
          // 빈 문자열 반환 (이미지 로드 실패 시 에러 처리기에서 처리)
          return '';
        }
      }).filter(url => url); // 빈 문자열 필터링
    }
  }
  
  return convertedData;
};

/**
 * 구글 Place API 데이터를 앱 형식 데이터로 한번에 변환
 * @param {Object} detailPlace - 구글 Place API 응답 객체
 * @param {string} apiKey - 구글 Maps API 키
 * @returns {Object} 앱 형식의 서버 데이터셋
 */
export const parseGooglePlaceData = (detailPlace, apiKey) => {
  const serializedData = serializeGooglePlaceData(detailPlace, apiKey);
  if (!serializedData) return null;
  
  return convertGooglePlaceToServerDataset(serializedData, apiKey);
};

/**
 * 구글 Place ID를 이용해서 상세 정보를 가져오는 함수
 * @param {string} placeId - 구글 Place ID
 * @param {string} apiKey - 구글 Maps API 키
 * @returns {Promise<Object>} 구글 Place 상세 데이터 (앱 형식으로 변환됨)
 */
export const fetchPlaceDetailById = async (placeId, apiKey) => {
  if (!placeId || !apiKey) {
    console.error('Place ID 또는 API 키가 없습니다.');
    return null;
  }

  try {
    // client-side에서 직접 Google API를 호출하면 CORS 이슈가 발생하므로
    // Google Maps JavaScript API를 사용하여 Place 상세 정보를 가져옵니다.
    return new Promise((resolve, reject) => {
      // Google Maps API가 로드되어 있는지 확인
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        console.error('Google Maps API가 로드되지 않았습니다.');
        reject(new Error('Google Maps API가 로드되지 않았습니다.'));
        return;
      }

      // Places 서비스 인스턴스 생성
      const placesService = new window.google.maps.places.PlacesService(
        // 임시 div 요소 (PlacesService는 지도 또는 HTML 요소가 필요함)
        document.createElement('div')
      );

      // 요청할 상세 정보 필드 지정
      const request = {
        placeId: placeId,
        fields: [
          'name', 'formatted_address', 'geometry', 'formatted_phone_number',
          'website', 'opening_hours', 'photos', 'place_id'
        ]
      };

      // 상세 정보 요청
      placesService.getDetails(request, (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          console.log('구글 Place API 응답 성공:', result);
          
          // 응답 데이터 변환
          const parsedData = parseGooglePlaceData(result, apiKey);
          resolve(parsedData);
        } else {
          console.error('구글 Place API 응답 에러:', status);
          reject(new Error(`Google Place API 응답 에러: ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('구글 Place 상세 정보 가져오기 실패:', error);
    return null;
  }
}; 