import { useState } from "react";
import SingleCheck from "./components/SingleCheck.jsx";
import BatchCheck from "./components/BatchCheck.jsx";

export default function App() {
  const [tab, setTab] = useState("single");

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white px-7 py-5 flex items-center gap-4 border-b-4 border-brass">
        <div className="w-[46px] h-[46px] rounded-full border-2 border-brass-light flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="#F7F5F0" strokeWidth="1.6" className="w-6 h-6">
            <path d="M8 3h8l1 4-1 12H8L7 7z" />
            <path d="M8 8h8" />
            <path d="M9 11h6" />
            <path d="M9 14h6" />
          </svg>
        </div>
        <div>
          <h1 className="font-display font-semibold text-[21px] m-0 tracking-wide">Label Verification Assistant</h1>
          <p className="text-[12.5px] text-[#C9D2E3] mt-0.5 tracking-wide">
            Prototype &middot; Compliance Division &middot; Not connected to COLA
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-7 pb-16">
        <div className="flex gap-1 mb-5 border-b-2 border-line">
          <Tab active={tab === "single"} onClick={() => setTab("single")}>
            Single Check
          </Tab>
          <Tab active={tab === "batch"} onClick={() => setTab("batch")}>
            Batch Check
          </Tab>
        </div>

        {tab === "single" ? <SingleCheck /> : <BatchCheck />}
      </main>

      <footer className="text-center text-[11.5px] text-[#a89f86] py-5">
        Extracted label text assists review; final compliance decisions remain with TTB staff. Built by Aqib Rahim.
      </footer>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <div
      onClick={onClick}
      className={`font-display font-semibold text-[15px] px-5 py-2.5 rounded-t-lg border-2 border-b-0 cursor-pointer relative top-0.5 ${
        active ? "bg-white text-navy border-line" : "bg-parchment-dark text-[#6b6455] border-line"
      }`}
    >
      {children}
    </div>
  );
}
