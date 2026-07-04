"""킥3 오프닝 슬라이드용 통계 — 비짓제주 콘텐츠수정요청 CSV 유형 분류.

발표 서사와 직결: "1,686건의 증거" — 요청을 몇 가지 축으로 나누어 정보 노후화
실증을 정직하게 보여준다.

CSV 컬럼: 요청아이디 | 콘텐츠아이디 | 제목 | 주소 | 도로명주소 | 소개 | 변경사항
유형이 별도 컬럼이 아니라 "변경사항" 자연어에 실려있으므로 우선순위 키워드 매칭.
한 행이 여러 카테고리에 걸치면 상단 우선순위로 귀속(중복 카운트 없음).

사용:
  python scripts/kick3_stats.py                # stdout 프린트 + docs/kick3_stats.md 갱신
  python scripts/kick3_stats.py --csv PATH
  python scripts/kick3_stats.py --out PATH     # md 저장 위치
"""
from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path

DEFAULT_CSV = Path("제주관광공사_비짓제주(VISIT JEJU)_콘텐츠수정요청_20250806 (1).CSV")
DEFAULT_OUT = Path("docs/kick3_stats.md")

CATEGORIES: list[tuple[str, list[str]]] = [
    ("폐업/영업종료",  ["폐업", "폐점", "영업 종료", "영업종료", "운영 종료", "운영종료", "문 닫", "종료됨"]),
    ("이전/위치변경",  ["이전", "이사", "옮김", "장소 변경", "장소변경", "위치 변경", "위치변경"]),
    ("운영시간/휴무",  ["운영시간", "영업시간", "휴무", "휴일", "시간 변경", "시간변경", "오픈시간", "마감시간"]),
    ("주소/도로명",    ["주소", "도로명", "번지"]),
    ("연락처/전화",    ["전화", "연락처", "번호 변경", "번호변경"]),
    ("메뉴/가격",      ["메뉴", "가격", "요금"]),
    ("사진/이미지",    ["사진", "이미지", "썸네일"]),
    ("상세정보 수정",  ["상세정보", "상세 정보", "내용 수정", "내용수정", "소개", "설명"]),
]


def classify(text: str) -> str:
    t = text or ""
    for name, kws in CATEGORIES:
        for kw in kws:
            if kw in t:
                return name
    return "기타"


def _open_csv(path: Path):
    for enc in ("cp949", "utf-8-sig", "utf-8"):
        try:
            with path.open(encoding=enc) as f:
                f.readline()
            return path.open(encoding=enc)
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"인코딩 감지 실패: {path}")


def collect(csv_path: Path) -> tuple[int, Counter, dict[str, str]]:
    total = 0
    counter: Counter = Counter()
    sample: dict[str, str] = {}
    with _open_csv(csv_path) as f:
        for row in csv.DictReader(f):
            total += 1
            cat = classify(row.get("변경사항", ""))
            counter[cat] += 1
            if cat not in sample:
                snippet = (row.get("변경사항", "") or "").replace("\n", " ").replace("\r", " ")
                sample[cat] = snippet[:80]
    return total, counter, sample


ORDER = [name for name, _ in CATEGORIES] + ["기타"]


def render_md(total: int, counter: Counter, sample: dict[str, str], csv_path: Path) -> str:
    lines = ["# 킥3 — 1,686건의 증거 (오프닝 슬라이드 자료)", ""]
    lines.append(f"- 소스: `{csv_path.name}`")
    lines.append(f"- 총 요청: **{total:,}건**")
    lines.append(f"- 재생성: `python scripts/kick3_stats.py`")
    lines.append("")
    lines.append("## 유형 분포")
    lines.append("| 카테고리 | 건수 | 비율 | 샘플 |")
    lines.append("|---|--:|--:|---|")
    for name in ORDER:
        n = counter.get(name, 0)
        if n == 0:
            continue
        pct = n / total * 100
        s = sample.get(name, "").replace("|", "\\|")
        lines.append(f"| {name} | {n:,} | {pct:.1f}% | {s} |")
    lines.append("")
    # 발표 프레이밍
    n_closed = counter.get("폐업/영업종료", 0)
    n_moved = counter.get("이전/위치변경", 0)
    n_hours = counter.get("운영시간/휴무", 0)
    n_addr = counter.get("주소/도로명", 0)
    physical = n_closed + n_moved + n_hours + n_addr
    lines.append("## 발표 프레이밍")
    lines.append("")
    lines.append("### A. 노후화 축 (킥1과 자연 연결) — 권장")
    lines.append("")
    lines.append(
        f"> \"1,686건 중 **{physical}건은 물리적 변화**입니다 — 폐업 {n_closed}, 이전 {n_moved}, "
        f"운영시간 변경 {n_hours}, 주소 {n_addr}. 원래 있던 곳이 지금은 다른 상태입니다. "
        f"공식 포털조차 이 속도로 낡습니다.\""
    )
    lines.append("")
    lines.append("### B. 상위 3개 강조")
    top3 = counter.most_common()
    # '기타' 제외 상위 3
    top3_no_other = [(k, v) for k, v in top3 if k != "기타"][:3]
    top3_sum = sum(v for _, v in top3_no_other)
    top3_str = ", ".join(f"{k} {v}" for k, v in top3_no_other)
    lines.append("")
    lines.append(f"> \"톱 3만 봐도 {top3_sum:,}건 — {top3_str}. 전체의 {top3_sum/total*100:.0f}%가 이미 부정확한 정보입니다.\"")
    lines.append("")
    lines.append("## 분류 규칙 (재현성)")
    lines.append("")
    lines.append("우선순위 키워드 매칭. 한 행이 여러 신호를 가지면 상단 카테고리로 귀속(중복 카운트 없음).")
    lines.append("")
    for name, kws in CATEGORIES:
        lines.append(f"- **{name}**: `{'` · `'.join(kws)}`")
    lines.append("- **기타**: 위 규칙 매칭 실패")
    return "\n".join(lines) + "\n"


def main() -> int:
    p = argparse.ArgumentParser(description="킥3 CSV 유형 분포 집계")
    p.add_argument("--csv", default=str(DEFAULT_CSV))
    p.add_argument("--out", default=str(DEFAULT_OUT))
    args = p.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"CSV not found: {csv_path}")
        return 2

    total, counter, sample = collect(csv_path)

    # stdout 요약
    print(f"총 요청: {total:,}건")
    print(f"{'카테고리':16s} {'건수':>6s}  {'비율':>6s}")
    print("-" * 40)
    for name in ORDER:
        n = counter.get(name, 0)
        if n == 0:
            continue
        print(f"{name:16s} {n:>6,}  {n/total*100:>5.1f}%")

    # md 저장
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render_md(total, counter, sample, csv_path), encoding="utf-8")
    print(f"\nsaved: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
