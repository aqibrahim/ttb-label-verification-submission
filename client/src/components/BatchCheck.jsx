import { useState } from "react";
import { verifyLabel } from "../api.js";
import Stamp from "./Stamp.jsx";
import ChecklistRow from "./ChecklistRow.jsx";

const DEFAULT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

let nextId = 1;
function blankRow() {
  return { id: nextId++, brand: "", classType: "", abv: "", net: "", file: null, status: "pending", result: null, error: null };
}

const CONCURRENCY = 3;

export default function BatchCheck() {
  const [warning, setWarning] = useState(DEFAULT_WARNING);
  const [rows, setRows] = useState([blankRow()]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(null);

  function updateRow(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }

  function removeRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function verifyAll() {
    if (!rows.length) return;
    setRunning(true);
    setElapsed(null);
    setRows((prev) => prev.map((r) => ({ ...r, status: "pending", result: null, error: null })));
    const t0 = performance.now();

    // Simple bounded-concurrency worker pool so a large batch doesn't
    // fire dozens of requests at once, but still processes several
    // labels in parallel rather than strictly one at a time.
    const queue = [...rows];
    async function worker() {
      while (queue.length) {
        const row = queue.shift();
        if (!row.file) {
          updateRow(row.id, { status: "fail", error: "No label photo selected for this entry." });
          continue;
        }
        try {
          const res = await verifyLabel({
            file: row.file,
            brand: row.brand,
            classType: row.classType,
            abv: row.abv,
            net: row.net,
            warning,
          });
          updateRow(row.id, { status: res.overall, result: res });
        } catch (err) {
          updateRow(row.id, { status: "fail", error: err.message });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
    setElapsed(((performance.now() - t0) / 1000).toFixed(1));
    setRunning(false);
  }

  return (
    <div>
      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <h2 className="font-display font-semibold text-[16.5px] text-navy mb-4 flex items-center gap-2">
          <span className="bg-navy text-white w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-xs font-body font-semibold">
            1
          </span>
          Shared Expected Government Warning
        </h2>
        <textarea
          value={warning}
          onChange={(e) => setWarning(e.target.value)}
          className="w-full border border-line rounded-md px-3 py-2 font-data text-xs bg-[#FEFDFB] focus:outline-2 focus:outline-brass-light min-h-[80px]"
        />
      </div>

      <div className="bg-white border border-line rounded-lg p-5 mb-5">
        <h2 className="font-display font-semibold text-[16.5px] text-navy mb-4 flex items-center gap-2">
          <span className="bg-navy text-white w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-xs font-body font-semibold">
            2
          </span>
          Labels in This Batch
        </h2>

        {rows.map((row, i) => (
          <BatchRow
            key={row.id}
            index={i}
            row={row}
            onChange={(patch) => updateRow(row.id, patch)}
            onRemove={() => removeRow(row.id)}
          />
        ))}

        <button
          onClick={addRow}
          className="font-display font-semibold text-[13px] px-3.5 py-1.5 rounded-md text-navy border border-navy hover:bg-[#eef0f4]"
        >
          + Add Another Label
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={verifyAll}
          disabled={running}
          className="font-display font-semibold text-[14.5px] px-6 py-2.5 rounded-md text-white bg-navy hover:bg-navy-light disabled:bg-[#9aa2b3]"
        >
          {running ? "Verifying batch..." : "Verify All"}
        </button>
        {elapsed && (
          <span className="text-[11.5px] text-[#948d78]">
            Batch of {rows.length} processed in {elapsed}s
          </span>
        )}
      </div>
    </div>
  );
}

function BatchRow({ index, row, onChange, onRemove }) {
  return (
    <div className="border border-line rounded-lg p-4 mb-3.5 bg-[#FEFDFB]">
      <div className="flex justify-between items-center mb-3">
        <span className="font-display font-semibold text-brass">Label #{index + 1}</span>
        <StatusPill status={row.status} />
      </div>

      <div className="grid md:grid-cols-4 gap-3 items-end mb-3">
        <MiniField label="Brand Name" value={row.brand} onChange={(v) => onChange({ brand: v })} />
        <MiniField label="Class / Type" value={row.classType} onChange={(v) => onChange({ classType: v })} />
        <MiniField label="Alcohol Content" value={row.abv} onChange={(v) => onChange({ abv: v })} placeholder="e.g. 45%" />
        <MiniField label="Net Contents" value={row.net} onChange={(v) => onChange({ net: v })} placeholder="e.g. 750 mL" />
      </div>

      <label className="inline-block text-xs px-2.5 py-1.5 bg-parchment-dark border border-line rounded cursor-pointer max-w-[220px] truncate">
        {row.file ? row.file.name : "Choose label photo..."}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onChange({ file: e.target.files[0] })}
        />
      </label>

      {row.error && (
        <div className="bg-fail-bg text-fail border border-fail rounded-md px-3 py-2 text-xs mt-3">{row.error}</div>
      )}
      {row.result && (
        <div className="mt-3">
          {row.result.demoMode && (
            <div className="bg-review-bg text-review border border-review rounded-md px-3 py-2 text-xs mb-3">
              <strong>Demo mode:</strong> canned example result — no model API key configured on this server.
            </div>
          )}
          <Stamp overall={row.result.overall} />
          {row.result.rows.map((r, i) => (
            <ChecklistRow key={i} row={r} />
          ))}
        </div>
      )}

      <div className="mt-3">
        <button
          onClick={onRemove}
          className="font-display font-semibold text-[13px] px-3.5 py-1.5 rounded-md text-fail border border-fail hover:bg-fail-bg"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function MiniField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#55503f] uppercase tracking-wide mb-1">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-line rounded-md px-2 py-1.5 text-sm bg-white focus:outline-2 focus:outline-brass-light"
      />
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    pending: "bg-[#eee] text-[#888]",
    pass: "bg-pass-bg text-pass",
    review: "bg-review-bg text-review",
    fail: "bg-fail-bg text-fail",
  };
  return (
    <span className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}
