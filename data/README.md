# data 폴더 기준

`data/`는 서비스 검증에 필요한 공개 원본 데이터와 재생성 가능한 산출물을 구분하기 위한 공간입니다.

## 커밋하는 파일

| 경로 | 설명 |
| --- | --- |
| `sources/visitjeju_fix_requests_20250806.csv` | 비짓제주 콘텐츠 수정요청 공개 CSV. 수정요청 이력과 발표 통계 근거로 사용 |

## 커밋하지 않는 파일

아래 파일은 실행 중 생성되거나 다시 만들 수 있으므로 `.gitignore` 대상입니다.

- `data/raw/`
- `data/probe/`
- `data/*.log`
- `data/*_smoke.json`
- `data/pack_*.json`
- `data/pack_*.pdf`
- `data/prod_*.pdf`

## 평가 리포트

새 평가 결과는 가능하면 `docs/eval/`에 저장합니다.

```powershell
python -m packages.eval.run --out docs/eval
```

과거 해커톤 진행 중 생성된 일부 평가 리포트는 발표 근거 보존을 위해 남아 있을 수 있습니다.
