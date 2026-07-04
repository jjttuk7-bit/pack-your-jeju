# 로컬 데모 실행 가이드

> Day4 발표 당일 노트북 1대에서 곧바로 데모를 돌리기 위한 순서.
> 발표장 Wi-Fi가 불안해도 이 순서만 따르면 시연이 성립한다.

## 사전 준비 (하루 전에 완료)

- Docker Desktop 실행 상태
- Python 3.11+
- `.env` 파일 존재 (`OPENAI_API_KEY`, `VISITJEJU_API_KEY`, `DATABASE_URL`)
- 저장소 루트에서 `pip install -e .[dev]` 완료

## Cold Start (DB 처음 세운 뒤 한 번만)

```powershell
# 1) DB 기동
docker compose up -d db

# 2) 비짓제주 5,756건 raw_source 적재 (약 3~5분)
python -m apps.pipelines.ingest_visitjeju --fetch-all

# 3) place 정제 적재 (약 20초, 4,400여 건)
python -m apps.pipelines.process

# 4) 데모용 신뢰 신호 seed
#    - has_fix_request 3건 (G09 caution 데모)
#    - tombstone 1건 (G14 contradicted 데모)
python -m apps.pipelines.ingest_file --seed-dev-fix-request --seed-region aewol --seed-category food --seed-limit 3
python -m apps.pipelines.ingest_file --seed-dev-tombstone   --seed-region aewol --seed-category food --seed-limit 3
```

## 매 발표 전 (Warm Start)

```powershell
# 1) DB 기동 확인
docker compose up -d db

# 2) 게이트 통과 확인 + 리포트 파일 저장 (백업)
python -m packages.eval.run --out data/eval

# 3) API 서버 기동 (포그라운드 — 발표 중 로그 실시간 관찰)
uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload
```

## 데모 중 사용하는 curl (본편 5분 스크립트 참고)

### G01 verified — 애월 · 오름 · 힐링
```bash
curl -sS http://localhost:8000/pack -H "Content-Type: application/json" -d '{
  "region":"aewol","start_date":"2026-07-04","days":3,
  "companion":"parents","purpose":"healing","moments":["oreum","local_food","sunset"]
}' | jq '.sections[]'
```

### G05 감귤 7월 — coverage_gap
```bash
curl -sS http://localhost:8000/pack -H "Content-Type: application/json" -d '{
  "region":"andeok","start_date":"2026-07-04","days":3,
  "companion":"family","purpose":"activity","moments":["citrus"]
}' | jq '.sections[0]'
```

### G11 우도 오름 — retrieval_miss(사용자엔 "인근 지역 결과")
```bash
curl -sS http://localhost:8000/pack -H "Content-Type: application/json" -d '{
  "region":"udo","start_date":"2026-07-04","days":2,
  "companion":"solo","purpose":"healing","moments":["oreum"]
}' | jq '.sections[0]'
```

### G14 킥1 — 폐업 가게 리뷰 검증
```bash
curl -sS http://localhost:8000/verify -H "Content-Type: application/json" -d '{
  "text":"애월오누이 제주 정말 맛있어요, 강추합니다. 그리고 우도 등대에서 노을을 봤는데 예뻐요."
}' | jq '.claims'
```

### 킥4 — 대시보드
```bash
curl -sS http://localhost:8000/admin/metrics?window_hours=1 | jq
```

## 리스크 대응

| 상황 | 대응 |
|---|---|
| DB가 안 뜬다 | 5432 포트 충돌 → 이 저장소는 5433으로 노출 (docker-compose.yml 확인) |
| ingest가 느리다 / 실패 | fetch-all은 5,756건에 3~5분. 시연 직전엔 재수집 금지. 이미 raw_source에 있는 데이터 사용 |
| LLM 문구 지연 | `OPENAI_API_KEY`를 빈 값으로 두면 자동 템플릿 폴백 |
| 발표장 인터넷 없음 | 모든 데모는 localhost에서 완결 — 문제 없음 |
| /pack 응답이 이상함 | eval 리포트(data/eval/eval-*.md)를 마지막 안전판으로 제시 |

## 원클릭 스크립트

`scripts/demo.ps1` — Warm Start 3단계를 한 번에 실행.
