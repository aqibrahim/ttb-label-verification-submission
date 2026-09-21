const ICONS = { pass: "\u2713", review: "?", fail: "\u2717" };
const COLORS = { pass: "text-pass", review: "text-review", fail: "text-fail" };

export default function ChecklistRow({ row }) {
  return (
    <div className="grid grid-cols-[26px_140px_1fr_1fr] gap-3 items-start py-2.5 border-b border-line last:border-b-0 text-[13.5px]">
      <div className={`text-center pt-px font-semibold ${COLORS[row.status]}`}>{ICONS[row.status]}</div>
      <div className="font-semibold text-[#55503f] pt-px">{row.name}</div>
      <div className="font-data text-xs">
        <span className="block font-body text-[10.5px] uppercase tracking-wide text-[#948d78] mb-0.5">
          Application
        </span>
        {row.appliedVal}
      </div>
      <div className="font-data text-xs">
        <span className="block font-body text-[10.5px] uppercase tracking-wide text-[#948d78] mb-0.5">
          Detected on Label
        </span>
        {row.labelVal}
        {row.note ? <div className="text-[12px] text-[#8a8368] italic mt-1 font-body">{row.note}</div> : null}
      </div>
    </div>
  );
}
