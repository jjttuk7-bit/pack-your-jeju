"""수정요청 CSV(1,686건) 유형 분류 + 도넛 차트.

정직성 원칙:
  - 이 분류는 '비짓제주 콘텐츠수정요청' 자유 텍스트에 대한 **키워드 규칙 기반**이다.
    공식 유형 체계가 아니므로 슬라이드에도 "키워드 분류 기준"임을 명시한다.
  - 규칙 우선순위는 아래 RULES 리스트 순서 그대로. 첫 매칭이 이긴다.
  - 규칙을 바꾸면 분포도 바뀐다 — 재현 가능하도록 이 파일과 결과 JSON을 함께 커밋.

산출물:
  data/eval/fix_request_dist.json  : {"categories":[...], "rules":[...], "total":N}
  docs/donut.png                   : 도넛 차트 이미지 (matplotlib)
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

# 우선순위 규칙. 위쪽 규칙이 아래를 이긴다.
# 각 규칙: (라벨, 정규식). 정규식은 변경사항 텍스트 전체에 대해 search.
RULES: list[tuple[str, str]] = [
    ("폐업/이전",   r"(폐업|폐점|폐관|영업\s*종료|문\s*닫|철거|이전\s*했|이전\s*하|없어졌|없어짐)"),
    ("주소/도로명", r"(주소|도로명|지번)"),
    ("운영시간",   r"(운영시간|영업시간|이용시간|오픈시간|폐장시간|마감|입장마감|휴무|정기휴일|시간\s*변경|시간\s*수정)"),
    ("전화/연락처", r"(전화|연락처|번호\s*변경|번호\s*수정|tel\s*[:：]|contact)"),
    ("홈페이지/링크", r"(홈페이지|웹사이트|url|링크|http|www\.)"),
    ("이미지/사진", r"(이미지|사진|photo|리솜\s*이미지|대표\s*이미지)"),
    ("가격/요금",  r"(가격|요금|입장료|이용료|비용|원\s*(?:으?로|→|>))"),
    ("상세정보/소개", r"(상세정보|소개|설명|내용\s*수정|안내)"),
]

OTHER_LABEL = "기타"


def classify(text: str) -> str:
    for label, pattern in RULES:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return label
    return OTHER_LABEL


def analyze(csv_path: Path) -> tuple[Counter, int]:
    counter: Counter = Counter()
    total = 0
    with csv_path.open(encoding="cp949") as f:
        reader = csv.DictReader(f)
        for row in reader:
            change = (row.get("변경사항") or "").strip()
            label = classify(change) if change else OTHER_LABEL
            counter[label] += 1
            total += 1
    return counter, total


def save_json(counter: Counter, total: int, out_path: Path) -> None:
    categories = [
        {"label": label, "count": counter.get(label, 0)}
        for label, _ in RULES
    ]
    categories.append({"label": OTHER_LABEL, "count": counter.get(OTHER_LABEL, 0)})

    payload = {
        "source": "비짓제주 콘텐츠수정요청 (제주관광공사 공공데이터)",
        "total": total,
        "categories": categories,
        "classifier": "keyword-rule (first-match, priority-ordered)",
        "rules": [
            {"label": label, "pattern": pattern}
            for label, pattern in RULES
        ],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                        encoding="utf-8")


def draw_donut(counter: Counter, total: int, out_path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    # 한글 폰트 자동 탐색 (Windows)
    for cand in ["Malgun Gothic", "Pretendard", "Apple SD Gothic Neo", "NanumGothic"]:
        try:
            font_manager.findfont(cand, fallback_to_default=False)
            plt.rcParams["font.family"] = cand
            break
        except Exception:
            continue
    plt.rcParams["axes.unicode_minus"] = False

    # 규칙 순서대로 시각화, 마지막에 기타
    labels_ordered = [label for label, _ in RULES] + [OTHER_LABEL]
    values = [counter.get(label, 0) for label in labels_ordered]
    # 0인 카테고리 숨김
    labels, values = zip(*[(l, v) for l, v in zip(labels_ordered, values) if v > 0])

    # 색 팔레트: 브랜드 오렌지 계열
    colors = [
        "#E76F51", "#F4A261", "#E9C46A", "#2A9D8F", "#264653",
        "#8AB17D", "#BC6C25", "#606C38", "#A0A0A0",
    ][: len(labels)]

    # 파이엔 % 만, 이름은 우측 범례로 → 라벨 겹침 방지 + 정보 밀도 유지
    fig, ax = plt.subplots(figsize=(9.0, 5.4), dpi=200)
    wedges, _autotexts = ax.pie(
        values,
        colors=colors,
        startangle=90,
        counterclock=False,
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
    )[0:2]

    # 가운데 큰 숫자
    ax.text(0, 0.10, f"{total:,}", ha="center", va="center",
            fontsize=38, fontweight="bold", color="#264653")
    ax.text(0, -0.05, "건", ha="center", va="center",
            fontsize=14, color="#264653")
    ax.text(0, -0.18, "비짓제주 콘텐츠 수정요청", ha="center", va="center",
            fontsize=9, color="#888888")

    # 우측 범례: 유형 · 비율 · 건수
    legend_labels = []
    for label, value in zip(labels, values):
        pct = value / total * 100
        legend_labels.append(f"{label}   {pct:>4.1f}%  ({value:,})")
    ax.legend(
        wedges, legend_labels,
        loc="center left",
        bbox_to_anchor=(1.02, 0.5),
        frameon=False,
        fontsize=11,
        handlelength=1.4,
        handletextpad=0.8,
        labelspacing=0.9,
    )

    ax.set_aspect("equal")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_path, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="수정요청 CSV 유형 분류 + 도넛")
    p.add_argument("--csv", required=True, help="수정요청 CSV 경로")
    p.add_argument("--out-json", default="data/eval/fix_request_dist.json")
    p.add_argument("--out-png",  default="docs/donut.png")
    args = p.parse_args(argv)

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    counter, total = analyze(csv_path)
    save_json(counter, total, Path(args.out_json))
    draw_donut(counter, total, Path(args.out_png))

    print(f"[analyze] total={total}")
    for label, _ in RULES:
        print(f"  {label:<12} {counter.get(label, 0):>5}")
    print(f"  {OTHER_LABEL:<12} {counter.get(OTHER_LABEL, 0):>5}")
    print(f"[analyze] json -> {args.out_json}")
    print(f"[analyze] png  -> {args.out_png}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
