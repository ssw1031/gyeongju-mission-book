# 경주 교과연계 체험학습 미션북 (웹앱)

나주동강중학교 2학년 3일 체험학습용 미션북 웹앱입니다.
순수 HTML/CSS/JS로 작동하며 외부 유료 API나 AI 호출을 사용하지 않습니다.

## 주요 기능
- 학생 로그인(학년 드롭다운 1·2·3 + 반 + 이름 · 번호 없음)
- 7개 미션 페이지(큰 네비게이션): 1. 책방무제 · 2. 대릉원 · **3. 첨성대(추가)** · 4. 동궁과 월지 · 5. 플래시백 계림 · 6. 나만의 한 장 · 7. 자기평가/우리 반 단체 미션
- 각 미션에 사진 업로드(자동 1024px 리사이즈) + 자유 서술 + 자기평가(리커트)
- **다른 탭을 터치해도 작성 내용 유지** (브라우저 로컬 스토리지에 자동 임시저장)
- 미션별 "제출" 시 Firebase Realtime Database + Google Sheets에 동시 전송
- 교사용 대시보드 (비밀번호 `0989`, UI에는 노출 X)
  - 학년 × 미션 매트릭스 뷰
  - 학년/미션/이름 필터 + 카드 리스트
  - 사진/텍스트 상세 모달 + **피드백 작성·저장**
  - **연동 설정 모달**에서 Firebase URL / Apps Script URL 입력, Code.gs 복사 UI 제공
- 다크/라이트 모드 전환(하단 바)
- 데스크톱 16:9 / 모바일 9:16 반응형

## 폴더 구조
```
.
├─ index.html
├─ vercel.json
├─ css/style.css
├─ js/
│   ├─ config.js      ← 상수/설정
│   ├─ storage.js     ← 로컬스토리지 + 이미지 리사이즈
│   ├─ firebase.js    ← RTDB REST
│   ├─ sheets.js      ← Apps Script 전송
│   ├─ missions.js    ← 미션/과제 정의 (수정하기 쉬움)
│   ├─ app.js         ← 학생 앱
│   └─ teacher.js     ← 교사 대시보드
├─ gas/Code.gs        ← Apps Script 코드
└─ assets/            ← 이미지(압축본)
```

## 실행 (로컬)
```bash
# 간단 정적 서버 (아무거나)
python3 -m http.server 5173
# http://localhost:5173
```

## GitHub → Vercel 배포
```bash
git init
git add -A
git commit -m "init: gyeongju mission book"
git branch -M main
git remote add origin https://github.com/<USER>/gyeongju-mission-book.git
git push -u origin main
```
1. [vercel.com](https://vercel.com) → New Project → 이 레포 선택
2. Framework: **Other**, Build Command 없음, Output Directory 비우기
3. Deploy 클릭 — 끝. (추가 설정 필요 없음)

## Firebase 설정
1. [Firebase 콘솔](https://console.firebase.google.com) → 프로젝트 생성
2. Build → Realtime Database → 데이터베이스 만들기 → "테스트 모드"로 시작
3. 데이터베이스 **URL**(`https://<project>-default-rtdb....firebasedatabase.app`)을
   교사 대시보드 → **연동 설정**에 입력하고 저장
4. 운영 시 보안 규칙은 다음과 같이 좁혀주세요(예시):
   ```json
   {
     "rules": {
       "submissions": { ".read": true, ".write": true },
       "feedback":    { ".read": true, ".write": true }
     }
   }
   ```

## Google Sheets 설정
1. 새 Google Sheet 생성
2. 확장 프로그램 → Apps Script → `gas/Code.gs` 전체 붙여넣기
3. 배포 → 새 배포 → 웹 앱 → 접근 "모든 사용자" → 배포
4. 발급된 **웹앱 URL**을 교사 대시보드 → 연동 설정에 입력

## 교사용 접속
학생 로그인 화면 하단의 "교사용" 버튼 → 비밀번호 `0989` 입력
(비밀번호는 `js/config.js`의 `GJ.TEACHER_PW`에서 변경 가능)

## 라이선스
학교 교실 내 교육용으로 자유롭게 수정·사용 가능합니다.
