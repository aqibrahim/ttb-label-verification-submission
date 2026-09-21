import { useRef, useState } from "react";
import { verifyLabel } from "../api.js";
import Stamp from "./Stamp.jsx";
import ChecklistRow from "./ChecklistRow.jsx";

const DEFAULT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export default function SingleCheck() {
  const [brand, setBrand] = useState("");
  const [classType, setClassType] = useState("");
  const [abv, setAbv] = useState("");
  const [net, setNet] = useState("");
  const [warning, setWarning] = useState(DEFAULT_WARNING);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const fileInputRef = useRef(null);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function clearFile() {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleVerify() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const t0 = performance.now();
    try {
      const res = await verifyLabel({ file, brand, classType, abv, net, warning });
      setResult(res);
      setElapsed(((performance.now() - t0) / 1000).toFixed(1));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white border border-line rounded-lg p-5">
          <h2 className="font-display font-semibold text-[16.5px] text-navy mb-4 flex items-center gap-2">
            <span className="bg-navy text-white w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-xs font-body font-semibold">
              1
            </span>
            Application Record
          </h2>

          <Field label="Brand Name" value={brand} onChange={setBrand} placeholder="e.g. Old Tom Distillery" />
          <Field
            label="Class / Type"
            value={classType}
            onChange={setClassType}
            placeholder="e.g. Kentucky Straight Bourbon Whiskey"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alcohol Content" value={abv} onChange={setAbv} placeholder="e.g. 45% Alc./Vol." />
            <Field label="Net Contents" value={net} onChange={setNet} placeholder="e.g. 750 mL" />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-[#55503f] uppercase tracking-wide mb-1">
              Expected Government Warning
            </label>
            <textarea
              value={warning}
              onChange={(e) => setWarning(e.target.value)}
              className="w-full border border-line rounded-md px-3 py-2 font-data text-xs bg-[#FEFDFB] focus:outline-2 focus:outline-brass-light min-h-[90px]"
            />
          </div>
        </div>

        <div className="bg-white border border-line rounded-lg p-5">
          <h2 className="font-display font-semibold text-[16.5px] text-navy mb-4 flex items-center gap-2">
            <span className="bg-navy text-white w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-xs font-body font-semibold">
              2
            </span>
            Label Image
          </h2>

          <label
            className="block border-2 border-dashed border-line rounded-lg p-6 text-center cursor-pointer bg-parchment-dark text-[#7a745f] hover:border-brass hover:text-brass transition-colors"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Label preview" className="max-h-64 mx-auto rounded-md border border-line" />
            ) : (
              <div>
                <div>Click to choose a label photo, or drag one here</div>
                <div className="text-xs mt-1">JPG, PNG, or WEBP</div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </label>

          <div className="flex items-center gap-2.5 mt-4">
            <button
              onClick={handleVerify}
              disabled={!file || loading}
              className="font-display font-semibold text-[14.5px] px-6 py-2.5 rounded-md text-white bg-navy hover:bg-navy-light disabled:bg-[#9aa2b3] disabled:cursor-not-allowed"
            >
              {loading ? "Verifying..." : "Verify Label"}
            </button>
            {file && (
              <button
                onClick={clearFile}
                className="font-display font-semibold text-[13px] px-3.5 py-1.5 rounded-md text-navy border border-navy hover:bg-[#eef0f4]"
              >
                Clear
              </button>
            )}
          </div>
          {elapsed && <div className="text-[11.5px] text-[#948d78] mt-1.5">Processed in {elapsed}s</div>}
        </div>
      </div>

      {(result || error) && (
        <div className="bg-white border border-line rounded-lg p-5 mt-5">
          <h2 className="font-display font-semibold text-[16.5px] text-navy mb-4 flex items-center gap-2">
            <span className="bg-navy text-white w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-xs font-body font-semibold">
              3
            </span>
            Result
          </h2>
          {error ? (
            <div className="bg-fail-bg text-fail border border-fail rounded-md px-3.5 py-2.5 text-sm">{error}</div>
          ) : (
            <>
              <Stamp overall={result.overall} />
              <div className="mt-2.5">
                {result.rows.map((row, i) => (
                  <ChecklistRow key={i} row={row} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div className="mb-3.5">
      <label className="block text-[12.5px] font-semibold text-[#55503f] uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-line rounded-md px-2.5 py-2 text-sm bg-[#FEFDFB] focus:outline-2 focus:outline-brass-light"
      />
    </div>
  );
}
