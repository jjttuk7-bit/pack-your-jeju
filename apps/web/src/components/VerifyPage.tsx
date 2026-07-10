import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import type { VerifyResponse, VerifyVerdict } from '../types';
import { requestVerify } from '../api';

/**
 * 킥1 데모 — 블로그 리뷰를 붙여넣기 → 문장별 판정.
 * TRUST_ENGINE.md §6.
 */
export default function VerifyPage() {
  const [text, setText] = useState<string>(
    '어제 새별오름 다녀왔는데 초보자도 오르기 좋아요. 우도 등대에서 노을 보면 인생샷 건집니다. 제주시 가상특이한이름카페12345에서 커피도 마셨어요.'
  );
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResp(null);
    try {
      const r = await requestVerify(text.trim());
      setResp(r);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4" id="verify-page">
      <div className="rounded-[24px] border border-orange-100/60 bg-white shadow-pyj-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex p-2.5 rounded-2xl bg-orange-50 text-orange-600 border border-orange-100 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <h2 className="font-bold text-[15px] text-stone-900 tracking-tight">리뷰 검증</h2>
            <p className="text-[11.5px] text-stone-500 leading-relaxed mt-0.5">
              블로그·카카오 리뷰를 붙여넣으면 문장별로 공공데이터와 대조해 판정합니다.
            </p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full px-3.5 py-3 rounded-2xl border border-stone-200 bg-[#FDFBF7] text-stone-800 text-[12.5px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition resize-none placeholder:text-stone-400"
          placeholder="리뷰 원문을 붙여넣으세요."
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold text-sm transition shadow-pyj-chip disabled:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {loading ? '판정 중…' : '검증하기'}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-[11px] text-rose-800 font-mono break-all">
          {error}
        </div>
      )}

      {resp && (
        <div className="space-y-2">
          <p className="text-[10.5px] text-stone-400 pl-1">
            {resp.claims.length}개 문장 · log_id {resp.log_id?.slice(0, 8) ?? '-'}
          </p>
          <FallbackGuide />
          {resp.claims.map((c, i) => (
            <React.Fragment key={i}>
              <ClaimCard idx={i} claim={c} />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function FallbackGuide() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/80 shadow-pyj-card p-3 space-y-2">
      <div>
        <p className="text-[11px] font-bold text-stone-800">판정 구조</p>
        <p className="text-[10.5px] text-stone-500 leading-relaxed mt-0.5">
          확인된 문장은 성공 판정으로 표시하고, 확인하지 못한 문장만 아래 4가지 fallback으로 분류합니다.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          ['out_of_scope', '제주 여행 범위 밖'],
          ['coverage_gap', '공공데이터 범위 밖'],
          ['retrieval_miss', '장소·필드 추출 실패'],
          ['contradicted', '반증 확인'],
        ].map(([key, desc]) => (
          <div key={key} className="rounded-xl border border-stone-100 bg-[#FDFBF7] px-2 py-1.5">
            <p className="text-[9.5px] font-bold text-orange-700">{key}</p>
            <p className="text-[9.5px] text-stone-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClaimCard({ idx, claim }: { idx: number; claim: VerifyResponse['claims'][number] }) {
  const style = verdictStyle(claim.verdict);
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`rounded-2xl border p-4 ${style.wrap}`}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 mt-0.5 ${style.iconColor}`}>{style.icon}</span>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-[13px] text-stone-900 leading-relaxed font-medium">{claim.text}</div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${style.chip}`}
            >
              {style.label}
            </span>
            {claim.fallback_reason && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-stone-200 bg-white/80 text-stone-600">
                fallback: {claim.fallback_reason}
              </span>
            )}
            {claim.matched_name && (
              <span className="text-[10.5px] text-stone-500 font-medium">→ {claim.matched_name}</span>
            )}
          </div>
          <p className="text-[11px] text-stone-600 leading-relaxed">{claim.reason}</p>
          {claim.sources.length > 0 && (
            <div className="pt-1 border-t border-stone-100">
              {claim.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10.5px] font-medium text-orange-700 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> {s.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function verdictStyle(v: VerifyVerdict) {
  switch (v) {
    case 'verified':
      return {
        label: '확인됨',
        icon: <CheckCircle2 className="w-5 h-5" />,
        iconColor: 'text-emerald-600',
        wrap: 'bg-white border-emerald-200 shadow-pyj-card',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'outdated':
      return {
        label: '정보 낡음',
        icon: <AlertTriangle className="w-5 h-5" />,
        iconColor: 'text-amber-600',
        wrap: 'bg-white border-amber-200 shadow-pyj-card',
        chip: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'contradicted':
      return {
        label: '반증 확인',
        icon: <XCircle className="w-5 h-5" />,
        iconColor: 'text-rose-600',
        wrap: 'bg-white border-rose-200 shadow-pyj-card',
        chip: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    case 'coverage_gap':
      return {
        label: '공공데이터 범위 밖',
        icon: <HelpCircle className="w-5 h-5" />,
        iconColor: 'text-stone-500',
        wrap: 'bg-white border-stone-200 shadow-pyj-card',
        chip: 'bg-stone-50 text-stone-700 border-stone-200',
      };
    case 'retrieval_miss':
      return {
        label: '검색 근거 부족',
        icon: <HelpCircle className="w-5 h-5" />,
        iconColor: 'text-stone-500',
        wrap: 'bg-white border-stone-200 shadow-pyj-card',
        chip: 'bg-stone-50 text-stone-700 border-stone-200',
      };
    case 'out_of_scope':
      return {
        label: '제주 범위 밖',
        icon: <HelpCircle className="w-5 h-5" />,
        iconColor: 'text-stone-500',
        wrap: 'bg-white border-stone-200 shadow-pyj-card',
        chip: 'bg-stone-50 text-stone-700 border-stone-200',
      };
    default:
      return {
        label: '확인 필요',
        icon: <HelpCircle className="w-5 h-5" />,
        iconColor: 'text-stone-500',
        wrap: 'bg-white border-stone-200 shadow-pyj-card',
        chip: 'bg-stone-50 text-stone-700 border-stone-200',
      };
  }
}
