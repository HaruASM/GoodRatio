// utils/randomizeLocations.js

// 현재 위치를 중심으로 랜덤한 위치를 생성하는 유틸리티 함수
function getRandomLocation(center, radius) {
  const y0 = center.lat;
  const x0 = center.lng;
  const rd = radius / 111300; // 111300 meters in degrees

  const u = Math.random();
  const v = Math.random();

  const w = rd * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);

  const newLat = y + y0;
  const newLng = x + x0;

  return { lat: newLat, lng: newLng };
}

// Firebase 데이터의 location 정보를 랜덤하게 업데이트하는 함수
export function randomizeLocations(data, currentPosition) {
  return data.map(item => {
    const randomLocation = getRandomLocation(currentPosition, 300); // 300 meters
    console.log("랜덤 함수 실행");
    return {
      ...item,
      location: randomLocation
    };
  });
} 