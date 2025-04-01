//#### AI는 이 파일의 메내용은 모두 무시
//#### 

1. dev 브랜치를 main 브랜치로 병합하기
bashCopy# 1. main 브랜치로 전환
git checkout main

# 2. main 브랜치를 최신 상태로 업데이트 (원격 저장소가 있는 경우)
git pull origin main

# 3. dev 브랜치를 main 브랜치로 병합
git merge dev

# 4. 충돌이 발생한 경우 해결 후 계속 진행
# (충돌 해결 후)
git add .
git commit -m "Merge dev into main"

# 5. 변경사항을 원격 저장소에 푸시 (필요한 경우)
git push origin main
2. dev 브랜치 다시 분기하기
이미 존재하는 dev 브랜치를 유지하려면:
bashCopy# 1. dev 브랜치로 전환
git checkout dev

# 2. main 브랜치의 변경사항을 dev 브랜치에 병합하여 동기화
git merge main
기존 dev 브랜치를 삭제하고 새로 생성하려면:
bashCopy# 1. 로컬 dev 브랜치 삭제 (선택 사항)
git branch -d dev

# 2. 원격 dev 브랜치 삭제 (선택 사항, 원격 저장소가 있는 경우)
git push origin --delete dev

# 3. main 브랜치에서 새 dev 브랜치 생성
git checkout main
git checkout -b dev

# 4. 새 dev 브랜치를 원격 저장소에 푸시 (필요한 경우)
git push -u origin dev
필요에 따라 어떤 방법을 선택하시면 되겠습니다. 브랜치 전략에 따라 적절한 방법을 선택하여 사용하시면 됩니다.

