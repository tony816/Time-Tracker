# 타임시트 (Time Tracker)

4시부터 다음날 3시까지를 한 화면에서 계획/시간/실제 3열로 관리하는 경량 시간 기록 도구입니다. 병합 기반 스케줄링, 실시간 타이머, 활동 로그, JSON 내보내기/가져오기, (선택) Notion 활동 동기화를 지원합니다.

## 주요 기능

- 시간 그리드: 4시 → 23시, 00시 → 03시까지 24개 슬롯 표시
- 3열 구성: 좌측 계획 | 중앙 시간/타이머 | 우측 실제 활동
- 날짜 네비게이션: 어제/오늘/내일 버튼과 달력 입력
- 병합 스케줄링: 계획 열을 여러 칸 선택 후 병합하면 시간/실제 열도 자동 동기화 병합
- 스케줄 입력 모달: 계획 열은 직접 편집하지 않고 모달에서 다중 선택(칩)으로 입력/수정
- 타이머: 현재 시간 범위+계획이 있을 때만 ▶️ 활성화, ⏸️/⏹️ 지원, 종료 시 실제 칸에 자동 기록(“공부 (00:25:10)” 등)
- 활동 로그: 우측 칸의 📝 버튼으로 제목/피드백 모달, 제목은 실제 칸과 동기화
- 성과 분석: 실행율(%)과 타이머 사용량(시/분/초) 표시, 색상으로 상태 구분
- 데이터 관리: 날짜별 자동 저장(LocalStorage), JSON 내보내기/가져오기
- Notion 동기화(선택): Notion DB의 페이지 제목을 “계획 활동” 후보 목록에 병합

## 사용법

### 계획 입력(좌측)
- 단일 선택: 셀 클릭
- 범위 선택: 클릭 후 드래그(좌측 열만 가능)
- 병합: 2칸 이상 선택 시 중앙에 “병합” 버튼 표시 → 클릭
- 되돌리기: 병합된 범위를 선택하면 “되돌리기(Undo)” 버튼 표시
- 스케줄 입력: 선택 시 오버레이 중앙의 📅 버튼 또는 좌측 셀 호버 시 📅 버튼 → 모달에서 다중 선택/추가/편집/삭제 가능
- 참고: 좌측 입력 필드는 읽기 전용이며, 편집은 모달로만 수행합니다.

### 실제 활동(우측)과 로그
- 각 행 우측의 입력칸에서 직접 편집 가능
- 병합된 범위는 첫 칸만 편집, 나머지는 묶여서 표시
- 📝 버튼으로 활동 로그 모달(제목/피드백) 열기 → 제목은 우측 실제 칸에 반영

### 타이머
- 활성화 조건: 현재 시간이 해당 행(또는 병합된 시간 범위)에 포함되고, 해당 범위의 계획이 비어있지 않을 때만 ▶️ 버튼 활성화
- 컨트롤: ▶️ 시작/재개, ⏸️ 일시정지, ⏹️ 정지(한 번에 하나의 타이머만 실행)
- 자동 기록: 정지 시 경과 시간 포맷(00:00:00)으로 우측 실제 칸에 자동 기록, 병합된 실제 칸이면 범위 전체 업데이트

### 내보내기/가져오기
- 내보내기: 하단 “내보내기” → 브라우저 LocalStorage의 모든 날짜 데이터를 하나의 JSON으로 저장
- 가져오기: “가져오기” → JSON 선택 → 중복 날짜는 덮어쓰기 여부 확인
- 지원 포맷
  - 전체: `{ version, exportedAt, dates: { 'YYYY-MM-DD': { date, timeSlots, mergedFields } } }`
  - 단일: `{ date, timeSlots, mergedFields }`
  - 배열: `[ { date, timeSlots, mergedFields }, ... ]`

## 실행 방법

- 빠르게 실행: `index.html`을 브라우저로 직접 열기
  - macOS: `open index.html`
  - Windows: `start index.html`
- 정적 서버(선택): `python -m http.server 8000` → `http://localhost:8000/`
- Notion 연동 서버(선택): 아래 “Notion 연동” 참고

## 서버 DB(선택) & 마이그레이션

- 서버는 SQLite를 사용해 날짜별 문서를 그대로 저장합니다.
  - 테이블: `timesheets(id, user_id, date, doc_json, exec_rate, total_seconds, created_at, updated_at)`
  - `doc_json`은 `{ date, timeSlots, mergedFields }` 원형 그대로 저장되어 내보내기/가져오기와 1:1 대응합니다.
- 계획 활동 카탈로그(로컬 추가분): `activity_catalog(title, source='local', external_id)`
- 마이그레이션: 앱 하단의 “서버로 마이그레이션” 버튼으로 LocalStorage의 모든 날짜/활동을 서버 DB로 이전할 수 있습니다.
  - 서버가 실행 중이어야 합니다(`npm start`).
  - API: `POST /api/migrate`로 `{ timesheets: [...], activities: [...] }`를 전송합니다.

## 저장소 구조

```
Time-Tracker/
├── index.html      # UI
├── styles.css      # 스타일
├── script.js       # 로직(슬롯/병합/타이머/로그/모달/저장/가져오기)
├── server.js       # (선택) Notion 브리지 서버
├── package.json    # (선택) 서버 실행 스크립트/의존성
└── README.md       # 문서
```

## 데이터 저장

- 날짜별 타임시트: `timesheet_YYYY-MM-DD`
- 계획 활동 카탈로그: `planned_activities`
- “초기화” 버튼은 현재 선택한 날짜의 데이터만 초기화합니다.

## Notion 연동(선택)

보안을 위해 Notion API 호출은 서버를 통해 진행합니다. 동기화 버튼은 서버의 `/api/notion/activities`에서 받아온 `{ activities: [{ id, title }] }`를 계획 활동 후보 목록에 병합합니다(서버가 없으면 비활성처럼 보일 수 있음).

### 준비물
- Notion 통합 토큰(Internal Integration Secret)
- 활동이 저장된 Notion 데이터베이스 ID

`.env` 예시(커밋 금지):

```
NOTION_API_KEY=secret_xxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
```

### 설치/실행

```
npm install
npm start
```

브라우저에서 `http://localhost:3000` 접속 시 `index.html`의 스니펫이 자동으로 `window.NOTION_ACTIVITIES_ENDPOINT = '/api/notion/activities'`를 설정합니다.

### 동작/제한
- 읽기 전용: Notion에서 받아온 제목은 로컬 후보 목록에만 병합되며, Notion으로 되돌려 쓰지는 않습니다.
- 캐시: 세션 내 1회 응답을 메모리 캐시에 보관하여 모달 재진입 시 빠르게 병합합니다.
- CORS: SPA와 API를 같은 포트(3000)에서 띄우는 것을 권장합니다(다른 포트에서 사용하려면 서버에 CORS 허용 추가 필요).

## 색상/분석 규칙

- 실행율: 계획이 있는 슬롯 중 실제가 채워진 비율(%)
  - 80% 이상: good, 60% 이상: warning, 그 외: poor
- 타이머 사용량: 총 경과 초 → “H시간 M분” 등 가독성 포맷으로 표시

## 문제 해결(FAQ)

- 동기화 버튼 반응 없음: 서버가 꺼져 있거나 엔드포인트 미설정일 수 있음. `npm start`로 서버 실행 후 `http://localhost:3000`에서 열어주세요.
- 400 invalid_request_url: 데이터베이스 ID 형식/공유 설정 확인. DB 링크의 32자리 hex(또는 하이픈 포함 UUID)를 사용하고, 통합을 DB에 초대하세요.
- 동기화 후 변화 없음: 새 제목이 없으면 목록 시각적 변화가 없을 수 있습니다.

---

**개발**: Claude Code로 생성/개선됨
