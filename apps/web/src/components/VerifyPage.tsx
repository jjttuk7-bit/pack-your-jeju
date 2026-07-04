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
    '어제 애월오누이 제주에서 저녁 먹었는데 진짜 맛있어요, 강추합니다. 그리고 새별오름 다녀왔는데 초보자도 오르기 좋아요. 우도 등대에서 노을 보면 인생샷 건집니다.'
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
      <div className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-100/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex p-2 rounded-2xl bg-orange-50 text-orange-600">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <div>
            <h2 className="font-bold text-slate-800">리뷰 검증</h2>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              블로그·카카오 리뷰를 붙여넣으세요. 문장별로 공공데이터와 대조해 판정합니다.
            </p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 bg-[#FAF9F6] text-slate-800 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 transition resize-none"
          placeholder="리뷰 원문을 붙여넣으세요."
        />

        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="w-full py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-semibold text-sm transition-all shadow-md shadow-orange-100 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          검증하기
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-800 font-mono break-all">
          {error}
        </div>
      )}

      {resp && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-400 pl-1">
            {resp.claims.length}개 문장 · log_id: {resp.log_id?.slice(0, 8) ?? '-'}
          </p>
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

function ClaimCard({ idx, claim }: { idx: number; claim: VerifyResponse['claims'][number] }) {
  const style = verdictStyle(claim.verdict);
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`rounded-2xl border p-3 space-y-1.5 ${style.wrap}`}
    >
      <div className="flex items-start gap-2">
        <span className={`shrink-0 mt-0.5 ${style.iconColor}`}>{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-800 leading-relaxed">{claim.text}</div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.chip}`}
            >
              {style.label}
            </span>
            {claim.matched_name && (
              <span className="text-[10px] text-slate-500">→ {claim.matched_name}</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{claim.reason}</p>
          {claim.sources.length > 0 && (
            <div className="mt-1">
              {claim.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-orange-700 hover:underline"
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
        icon: <CheckCircle2 className="w-4 h-4" />,
        iconColor: 'text-emerald-600',
        wrap: 'bg-emerald-50/40 border-emerald-100',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'outdated':
      return {
        label: '정보 낡음',
        icon: <AlertTriangle className="w-4 h-4" />,
        iconColor: 'text-amber-600',
        wrap: 'bg-amber-50/40 border-amber-100',
        chip: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'contradicted':
      return {
        label: '폐업/변경 확인',
        icon: <XCircle className="w-4 h-4" />,
        iconColor: 'text-rose-600',
        wrap: 'bg-rose-50/40 border-rose-100',
        chip: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    default:
      return {
        label: '확인 불가',
        icon: <HelpCircle className="w-4 h-4" />,
        iconColor: 'text-slate-500',
        wrap: 'bg-slate-50/40 border-slate-100',
        chip: 'bg-slate-50 text-slate-700 border-slate-200',
      };
  }
}
