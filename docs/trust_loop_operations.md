# 제주를 담다 신뢰 루프 운영 런북

## 이벤트 흐름

1. 사용자가 플랜 장소의 방문 결과를 제출한다.
2. `visit_feedback`에 원문 피드백을 보존한다.
3. 최근 30일 독립 신호를 집계해 `place_trust_profile`을 갱신한다.
4. 임계치를 넘을 때만 `moderation_case`를 연다.
5. 운영자가 출처를 확인하고 승인한 경우에만 `public_data_correction`을 만든다.

## 장애 대응

- 인증 설정 오류: 사용자에게 로그인 설정 문제를 표시하고, 피드백 원문은 로컬 임시 저장만 허용한다.
- DB 장애: `503`과 `db_unavailable`을 반환한다. 공공데이터가 없다고 해석하거나 다른 후보로 조용히 대체하지 않는다.
- 검색 장애: 확인된 출처와 확인하지 못한 범위를 분리해 표시한다.
- 증빙 저장 장애: 텍스트 피드백과 파일 저장 상태를 분리하고, 서비스 키·서명 URL을 로그에 남기지 않는다.

## 확인할 로그

`pack_your_jeju.events` 로거의 JSON 이벤트를 Railway 로그에서 검색한다.

- `feedback_submitted`
- `moderation_case_opened`
- `moderation_case_priority_updated`
- `public_data_correction_approved`

개인 메모, Authorization 헤더, Supabase 서비스 키와 토큰은 로그에 기록하지 않는다.

## 배포 전 점검

- `DATABASE_URL`, Supabase JWT/JWKS 설정 확인
- `SUPABASE_EVIDENCE_BUCKET` 존재 여부 확인
- `python -m pytest apps/api/tests -q`
- `npm run lint && npm run build` (apps/web)
- 공개 API가 관리자 검토 케이스를 노출하지 않는지 확인
