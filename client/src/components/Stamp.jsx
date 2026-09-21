const CONFIG = {
  pass: { color: "text-pass", line1: "MATCH", line2: "APPROVED FOR REVIEW" },
  review: { color: "text-review", line1: "REVIEW", line2: "NEEDS AGENT CHECK" },
  fail: { color: "text-fail", line1: "MISMATCH", line2: "FLAGGED" },
};

export default function Stamp({ overall }) {
  const c = CONFIG[overall] || CONFIG.review;
  return (
    <div className="flex justify-center py-2">
      <div
        className={`w-32 h-32 rounded-full border-4 ${c.color} flex flex-col items-center justify-center font-display font-bold uppercase tracking-wide -rotate-6 animate-stamp-in`}
      >
        <div className="text-lg leading-tight">{c.line1}</div>
        <div className="text-[11px] font-body font-semibold tracking-[2px] mt-1">{c.line2}</div>
      </div>
    </div>
  );
}
