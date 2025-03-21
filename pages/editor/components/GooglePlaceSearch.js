// 장소 선택 핸들러
const handlePlaceSelected = (place) => {
  if (!place || !place.geometry) {
    console.error('선택된 장소 정보가 없습니다.');
    return;
  }

  // 이미 선택된 상점을 편집하는 상황에서만 Google Place 데이터를 사용
  if (isEditing && shouldComparePlace) {
    // 직렬화 가능한 형태로 데이터 변환
    const serializedPlace = {
      ...place,
      geometry: {
        ...place.geometry,
        // location 객체의 함수를 값으로 변환
        location: place.geometry.location ? {
          lat: typeof place.geometry.location.lat === 'function' ? 
               place.geometry.location.lat() : place.geometry.location.lat,
          lng: typeof place.geometry.location.lng === 'function' ? 
               place.geometry.location.lng() : place.geometry.location.lng
        } : null
      }
    };

    // 필요한 시점에 직렬화 변환된 데이터 사용
    dispatch(compareGooglePlaceData(serializedPlace));
    console.log('구글 장소 선택됨:', place.name);
  } else {
    // 그 외의 경우에는 지도 이동만 수행
    if (onPlaceSelected) {
      onPlaceSelected(place);
    }
    console.log('구글 장소 선택됨 (비교 없음):', place.name);
  }
}; 