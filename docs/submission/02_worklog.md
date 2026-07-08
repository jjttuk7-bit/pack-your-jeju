# 제주를 담다 작업내역

## 1. 작업 요약

제주를 담다는 4일 해커톤 규정에 맞춰 `gpt-5-mini 단일 모델 + RAG + 공공데이터 검증` 구조로 구현한 제주 여행 정보 신뢰도 분석 서비스다.

작업은 다음 순서로 진행했다.

1. 제주 여행 정보 신뢰도 문제 정의
2. 비짓제주와 수정요청 데이터를 활용한 RAG 검색 구조 구현
3. 지역 선택 지도와 신뢰 대시보드 구현
4. 후보 카드별 신뢰 점수와 확인 필요 항목 추가
5. 기상청 단기예보를 여행 기간 기준으로 반영
6. 플랜 담기, 지도 마커, 맞춤 짐, 공유 문구 구현
7. 방문 후 피드백과 신뢰도 변화 시뮬레이션 추가
8. 하루방 에이전트와 리뷰 검증 화면 추가
9. 배포 안정화와 GitHub 공유용 저장소 정리

## 2. 주요 구현 내역

### 2.1 신뢰 기반 여행팩 생성

- 사용자가 지역, 여행 기간, 동행자, 목적, 순간 카드를 선택하면 `/pack` API가 후보를 생성한다.
- 장소명, 주소, 좌표, 출처는 공공데이터 조회 결과만 사용한다.
- 결과가 없을 경우 임의 추천을 생성하지 않고 fallback reason으로 분류한다.
- 후보 카드에는 신뢰 점수, 배지, 확인 필요 항목, 출처, 이동 신호를 함께 보여준다.

관련 파일:

- `apps/api/engine/search.py`
- `apps/api/engine/trust.py`
- `apps/api/engine/assemble.py`
- `apps/web/src/components/PackingDashboard.tsx`

### 2.2 지역 신뢰 대시보드

- 제주 지역을 지도 형태로 나누고 지역별 추천 가능성과 데이터 부족 신호를 보여준다.
- 사용자가 지역을 선택하면 오른쪽 카드에서 추천 가능한 순간, 확인 필요 항목, 실제 후보를 확인할 수 있다.
- 초기에는 지도 실루엣과 지역 위치가 어색했지만, 제주 행정구역 구분에 맞게 지속적으로 보정했다.

관련 파일:

- `apps/web/src/components/TrustMapDashboard.tsx`
- `apps/web/public/jeju_silhouette_refined.svg`

### 2.3 날씨 신호 반영

- 초기에는 KMA API 응답이 숫자 중심으로 표시되어 사용자가 읽기 어려웠다.
- 기상청 단기예보 조회서비스를 사용해 여행 시작일과 여행 기간 기준의 예보 요약을 만들었다.
- 장소 카드마다 반복 표시하던 날씨 정보를 줄이고, 좌측 여행 정보 영역에서 기간별 요약을 보여주도록 개선했다.

관련 파일:

- `apps/api/engine/weather.py`
- `apps/web/src/components/PackingDashboard.tsx`

### 2.4 플랜 담기와 지도 마커

- 사용자는 후보 카드를 내 여행플랜에 담을 수 있다.
- 플랜에 담긴 장소는 네이버 지도에 실제 좌표 마커로 표시한다.
- `/pack` 응답에 좌표가 빠져 있던 문제를 찾아 `latitude`, `longitude`를 응답에 포함하도록 수정했다.
- 네이버 지도 인증 실패 시에도 간이 제주 지도에 좌표 기반 번호 마커를 표시하도록 fallback을 추가했다.

관련 파일:

- `apps/api/main.py`
- `apps/api/engine/trust.py`
- `apps/web/src/components/PackingDashboard.tsx`

### 2.5 방문 피드백과 신뢰도 변화

- 사용자가 여행 후 방문함, 방문하지 않음, 변경함, 정보 다름, 만족, 불만족을 남길 수 있게 했다.
- 피드백은 로컬 UI뿐 아니라 `/visit-signals` API 흐름으로 연결했다.
- 방문 피드백은 다음 신뢰도 판단에 반영될 수 있는 독립 신호로 설계했다.
- 공공데이터 자체와 사용자 피드백을 섞지 않고, 수정요청 큐로 분리해 보여준다.

관련 파일:

- `apps/api/engine/visit_signals.py`
- `apps/api/main.py`
- `apps/web/src/components/PackingDashboard.tsx`

### 2.6 하루방 에이전트

- 하루방 에이전트는 현재 선택 조건, 플랜 상태, 데이터 부족 조합을 요약한다.
- 초기에는 다음 화면 진입 시 자동 팝업이 열려 UI를 가렸고, 사용자가 직접 눌렀을 때만 열리도록 수정했다.
- 캐릭터도 더 친근한 톤으로 조정했다.

관련 파일:

- `apps/api/engine/haruban.py`
- `apps/web/src/components/HarubanChat.tsx`
- `apps/web/src/components/marks/HarubangMark.tsx`

### 2.7 리뷰 검증

- 사용자가 리뷰 문장을 입력하면 claim 단위로 나누고 공공데이터와 대조한다.
- 결과는 확인됨, 주의, 공공데이터 기준 미확인으로 분리한다.
- 기본 GPT 답변과 달리 "왜 그렇게 판단했는지"를 출처 기반으로 설명한다.

관련 파일:

- `apps/api/engine/verify.py`
- `apps/web/src/components/VerifyPage.tsx`

### 2.8 저장소 정리와 배포 문서화

- README를 최신 서비스 기준으로 전면 재작성했다.
- `docs/PROJECT_STRUCTURE.md`를 추가해 외부 공유용 폴더 구조를 설명했다.
- 루트에 있던 긴 원본 CSV 파일을 `data/sources/visitjeju_fix_requests_20250806.csv`로 이동했다.
- 재생성 가능한 스모크 JSON 일부를 제거하고 `.gitignore`를 보강했다.
- Vercel, Railway, Naver Map, KMA 관련 환경변수 설명을 추가했다.

관련 파일:

- `README.md`
- `docs/PROJECT_STRUCTURE.md`
- `data/README.md`
- `docs/deploy.md`
- `.env.example`
- `apps/web/.env.example`

## 3. 주요 문제와 해결

| 문제 | 해결 |
| --- | --- |
| 지도 형태와 지역 위치가 제주 행정구역과 맞지 않음 | 제주 지도 실루엣과 행정구역 위치를 재조정 |
| 후보 카드의 정보가 목업처럼 보임 | 기존 공공데이터 응답을 유지하고 구조와 가독성만 개선 |
| 날씨 API 응답이 숫자 중심이라 읽기 어려움 | 여행 기간별 문장형 예보 카드로 변환 |
| 장소마다 날씨가 반복 표시됨 | 좌측 여행 정보 영역에 기간별 요약으로 통합 |
| 플랜 지도에 마커가 표시되지 않음 | 백엔드 좌표 응답 추가, 기존 플랜 항목 좌표 보강 |
| 네이버 지도 인증 실패 시 회색 오류 화면 발생 | 간이 제주 지도 fallback과 좌표 마커 표시 |
| 하루방 에이전트 팝업이 화면을 가림 | 자동 팝업 제거, 사용자가 클릭할 때만 열리도록 수정 |
| 맞춤 짐 추천 이유 문구가 반복됨 | 반복 표현 제거, 일정 이유 중심 문장으로 정리 |

## 4. 검증 기록

최근 확인한 명령:

```powershell
python -m pytest apps/api/tests/test_pack_integration.py apps/api/tests/test_weather.py
cd apps/web
npm run lint
npm run build
python scripts/kick3_stats.py
```

확인 결과:

- `/pack` 통합 테스트 통과
- 기상청 예보 처리 테스트 통과
- 프론트 TypeScript 검사 통과
- 프론트 프로덕션 빌드 통과
- 콘텐츠 수정요청 CSV 통계 재생성 성공

## 5. 평가 항목별 작업 근거

| 평가 영역 | 작업 근거 |
| --- | --- |
| 문제 정의·기획 | 여행 정보 과잉보다 신뢰 판단이 어렵다는 문제로 재정의 |
| 모델 설계·활용 | gpt-5-mini를 자유 생성이 아니라 RAG 근거 요약과 검증 설명에 사용 |
| 서비스 견고성 | API 키 미설정, 네이버 지도 인증 실패, 외부 API 실패 시 fallback 설계 |
| 신뢰성·설득력 | 출처, 수정요청, 신뢰 점수, 확인 필요 항목, 피드백 루프를 화면에 노출 |
| 보안 | `.env.example`만 제공하고 실제 키는 Vercel/Railway 환경변수로 관리 |

## 6. 남은 고도화 방향

해커톤 범위 이후 확장할 수 있는 작업:

- 사용자 피드백을 DB 기반 신뢰도 업데이트에 더 깊게 반영
- 공공데이터 수정요청 제출 또는 관리기관 전달 워크플로우 연결
- 장소별 신뢰 히스토리 대시보드
- 기본 GPT 추천과 제주를 담다 RAG 결과의 정량 비교 화면 강화
- 로그인 기반 개인 플랜 저장과 공유 링크 고도화
