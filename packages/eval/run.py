"""골든셋 러너 (EVAL_GOLDENSET.md §1·§3).

지표 게이트:
  - Verified Precision  ≥ 0.9    (verified 배지가 min_items 조건 통과 비율)
  - Fallback Accuracy   ≥ 0.9    (fallback 케이스 reason 일치 비율)
  - Badge Accuracy      ≥ 0.8    (caution/contradicted 기대 케이스 배지 일치 비율)

발표 서사 (D-13): "게이트 미통과 시 배포하지 않음" → exit(1).

원칙:
  - 서버 없이 엔진 함수 직접 호출.
  - external_id 기반 비교 (문서 지침). 지금은 min_items/note/verdict 위주로 유연 검증.
  - FILL_ME는 아직 없음. 향후 must_include_external_ids 확장 여지 유지.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from apps.api.engine import filters as filters_mod
from apps.api.engine import trust as trust_mod
from apps.api.engine import verify as verify_mod

GOLDEN_SET_DEFAULT = Path(__file__).parent / "golden_set.jsonl"


# ---- 결과 타입 ----

@dataclass
class CaseResult:
    id: str
    endpoint: str
    passed: bool
    bucket: str            # "verified" | "fallback" | "badge"
    reason: str = ""
    debug: dict | None = None


# ---- 케이스 실행 ----

def _run_pack_case(case: dict) -> CaseResult:
    req = filters_mod.PackRequest.from_dict(case["request"])
    filters = filters_mod.build_filters(req)
    expect = case["expect"]
    target_moment = expect["moment"]

    # target moment 하나만 검증
    mf = next((m for m in filters.per_moment if m.moment == target_moment), None)
    if mf is None:
        return CaseResult(
            id=case["id"], endpoint="pack", passed=False, bucket="fallback",
            reason=f"target moment {target_moment} not in request",
        )
    section = trust_mod.judge_section(mf)

    # bucket 결정: fallback_reason 명시가 있으면 fallback, 그 외는 verified/badge
    bucket = "fallback" if "fallback_reason" in expect else "verified"

    fails: list[str] = []

    exp_reason = expect.get("fallback_reason")
    got_reason = section.fallback.reason if section.fallback else None
    if "fallback_reason" in expect and got_reason != exp_reason:
        fails.append(f"fallback_reason expected={exp_reason} got={got_reason}")

    if "min_items" in expect and len(section.items) < expect["min_items"]:
        fails.append(f"min_items {expect['min_items']} but got {len(section.items)}")
    if "max_items" in expect and len(section.items) > expect["max_items"]:
        fails.append(f"max_items {expect['max_items']} but got {len(section.items)}")

    if expect.get("message_no_denial") and section.fallback:
        if "없습니다" in section.fallback.message:
            fails.append("message contains '없습니다' (denial banned)")
        if "확인되지 않" not in section.fallback.message:
            fails.append("message missing '확인되지 않' expression")

    if expect.get("any_item_has_note"):
        if not any(it.note for it in section.items):
            fails.append("expected any_item_has_note but no notes present")

    if "any_item_note_contains" in expect:
        needle = expect["any_item_note_contains"]
        if not any(it.note and needle in it.note for it in section.items):
            fails.append(f"expected note containing '{needle}'")
            bucket = "badge"  # 배지 하향(caution) 관련 규칙

    if "any_item_badge" in expect:
        target = expect["any_item_badge"]
        if not any(it.badge == target for it in section.items):
            fails.append(f"expected any_item_badge={target}")
            bucket = "badge"

    if "all_items_badge_in" in expect:
        allowed = set(expect["all_items_badge_in"])
        offenders = [it.badge for it in section.items if it.badge not in allowed]
        if offenders:
            fails.append(f"badges not in {sorted(allowed)}: {offenders}")
        bucket = "badge"

    if "observed_reason" in expect:
        if expect["observed_reason"] not in section.observed_reasons:
            fails.append(f"expected observed_reason {expect['observed_reason']} in {section.observed_reasons}")
        bucket = "fallback"

    return CaseResult(
        id=case["id"], endpoint="pack",
        passed=not fails, bucket=bucket,
        reason="; ".join(fails),
        debug={
            "items": [(it.name, it.badge, it.note) for it in section.items],
            "fallback": section.fallback.__dict__ if section.fallback else None,
            "observed": section.observed_reasons,
        },
    )


def _run_verify_case(case: dict) -> CaseResult:
    req = case["request"]
    expect = case["expect"]
    results = verify_mod.verify_text(req["text"])
    verdicts = [r.verdict for r in results]

    bucket = "fallback"
    fails: list[str] = []

    if "any_verdict" in expect:
        target = expect["any_verdict"]
        if target not in verdicts:
            fails.append(f"expected verdict {target} in {verdicts}")

    if "any_verdict_in" in expect:
        allowed = set(expect["any_verdict_in"])
        if not (allowed & set(verdicts)):
            fails.append(f"no verdict in {sorted(allowed)}, got {verdicts}")
        bucket = "verified"

    if expect.get("message_no_denial"):
        gap_msgs = [r.reason for r in results if r.verdict == "coverage_gap"]
        for m in gap_msgs:
            if "없습니다" in m:
                fails.append(f"denial banned but reason contained '없습니다': {m}")
            if "확인되지 않" not in m:
                fails.append(f"reason missing '확인되지 않': {m}")

    return CaseResult(
        id=case["id"], endpoint="verify",
        passed=not fails, bucket=bucket,
        reason="; ".join(fails),
        debug={"verdicts": [(r.text[:30], r.verdict, r.matched_name) for r in results]},
    )


# ---- 러너 ----

def load_cases(path: Path) -> list[dict]:
    cases: list[dict] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("//") or line.startswith("#"):
            continue
        try:
            cases.append(json.loads(line))
        except json.JSONDecodeError as e:
            raise ValueError(f"golden_set.jsonl line {line_no}: {e}") from e
    return cases


def run_all(path: Path) -> tuple[list[CaseResult], dict[str, float]]:
    cases = load_cases(path)
    results: list[CaseResult] = []
    for case in cases:
        endpoint = case.get("endpoint", "pack")
        try:
            if endpoint == "verify":
                results.append(_run_verify_case(case))
            else:
                results.append(_run_pack_case(case))
        except Exception as e:
            results.append(CaseResult(
                id=case["id"], endpoint=endpoint, passed=False,
                bucket="verified", reason=f"exception: {type(e).__name__}: {e}",
            ))

    metrics = _score(results)
    return results, metrics


def _score(results: list[CaseResult]) -> dict[str, float]:
    by_bucket: dict[str, list[CaseResult]] = {"verified": [], "fallback": [], "badge": []}
    for r in results:
        by_bucket.setdefault(r.bucket, []).append(r)

    def ratio(rs: list[CaseResult]) -> float:
        if not rs:
            return 1.0
        return sum(1 for r in rs if r.passed) / len(rs)

    return {
        "verified_precision": ratio(by_bucket.get("verified", [])),
        "fallback_accuracy":  ratio(by_bucket.get("fallback", [])),
        "badge_accuracy":     ratio(by_bucket.get("badge", [])),
    }


GATE_THRESHOLDS = {
    "verified_precision": 0.9,
    "fallback_accuracy":  0.9,
    "badge_accuracy":     0.8,
}


def print_report(results: list[CaseResult], metrics: dict[str, float]) -> bool:
    passed = sum(1 for r in results if r.passed)
    print(f"[eval] cases: {passed}/{len(results)} passed")
    for r in results:
        mark = "PASS" if r.passed else "FAIL"
        print(f"  {mark} {r.id:<4} [{r.bucket:<8}] {r.reason}")
        if not r.passed and r.debug:
            print(f"       debug: {r.debug}")
    print("[eval] metrics:")
    green = True
    for k, v in metrics.items():
        threshold = GATE_THRESHOLDS[k]
        status = "OK " if v >= threshold else "MISS"
        print(f"  {status} {k:<20} = {v:.2f}  (>= {threshold})")
        if v < threshold:
            green = False
    return green


def _save_report_json(results: list[CaseResult], metrics: dict[str, float], path: Path) -> None:
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cases": [asdict(r) for r in results],
        "metrics": metrics,
        "thresholds": GATE_THRESHOLDS,
        "green": all(metrics[k] >= GATE_THRESHOLDS[k] for k in GATE_THRESHOLDS),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str),
                    encoding="utf-8")


def _save_report_md(results: list[CaseResult], metrics: dict[str, float], path: Path) -> None:
    lines: list[str] = []
    lines.append(f"# Golden Set 게이트 리포트")
    lines.append("")
    lines.append(f"- 생성: {datetime.now(timezone.utc).isoformat()}")
    passed = sum(1 for r in results if r.passed)
    lines.append(f"- 결과: **{passed}/{len(results)}** 통과")
    green = all(metrics[k] >= GATE_THRESHOLDS[k] for k in GATE_THRESHOLDS)
    lines.append(f"- 게이트: {'🟢 통과' if green else '🔴 미달'}")
    lines.append("")
    lines.append("## 지표")
    lines.append("| 지표 | 값 | 임계 | 상태 |")
    lines.append("|---|---|---|---|")
    for k, v in metrics.items():
        t = GATE_THRESHOLDS[k]
        mark = "🟢" if v >= t else "🔴"
        lines.append(f"| {k} | {v:.2f} | ≥ {t} | {mark} |")
    lines.append("")
    lines.append("## 케이스별")
    lines.append("| ID | endpoint | bucket | 결과 | 실패 사유 |")
    lines.append("|---|---|---|---|---|")
    for r in results:
        mark = "✅" if r.passed else "❌"
        reason = r.reason.replace("|", "\\|") if r.reason else ""
        lines.append(f"| {r.id} | {r.endpoint} | {r.bucket} | {mark} | {reason} |")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="골든셋 게이트 러너")
    p.add_argument("--set", default=str(GOLDEN_SET_DEFAULT), help="golden_set.jsonl 경로")
    p.add_argument("--out", default=None,
                   help="리포트 저장 디렉토리 (report.json + report.md 생성). "
                        "기본 파일명: eval-YYYYMMDD-HHMM.json/.md")
    args = p.parse_args(argv)

    results, metrics = run_all(Path(args.set))
    green = print_report(results, metrics)

    if args.out:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
        out_dir = Path(args.out)
        _save_report_json(results, metrics, out_dir / f"eval-{ts}.json")
        _save_report_md(results, metrics, out_dir / f"eval-{ts}.md")
        print(f"[eval] report saved: {out_dir}/eval-{ts}.(json|md)")

    return 0 if green else 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
