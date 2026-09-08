"use client";

import { useState } from "react";
import { Coins } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";

const DICE_EMOJI: Record<number, string> = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };

export default function CoinDiceRoller() {
  const [tab, setTab] = useState<"coin" | "dice">("coin");
  const [coinCount, setCoinCount] = useState(5);
  const [dieSides, setDieSides] = useState(6);
  const [diceCount, setDiceCount] = useState(3);
  const [coinResults, setCoinResults] = useState<("Heads" | "Tails")[]>([]);
  const [dieResults, setDieResults] = useState<number[]>([]);

  const flipCoins = () => {
    setCoinResults(Array.from({ length: Math.max(1, Math.min(coinCount, 100)) }, () => (Math.random() < 0.5 ? "Heads" : "Tails")));
  };

  const rollDice = () => {
    const sides = Math.max(2, Math.min(dieSides, 1000));
    setDieResults(Array.from({ length: Math.max(1, Math.min(diceCount, 100)) }, () => Math.floor(Math.random() * sides) + 1));
  };

  const heads = coinResults.filter((c) => c === "Heads").length;
  const tails = coinResults.length - heads;

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <Coins className="w-4 h-4 text-yellow-600" />
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(["coin", "dice"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition ${tab === t ? "bg-yellow-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {t === "coin" ? "Coin Flip" : "Dice Roll"}
            </button>
          ))}
        </div>
      </div>

      {tab === "coin" && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Flips</label>
              <input
                type="number"
                min={1}
                value={coinCount}
                onChange={(e) => setCoinCount(Number(e.target.value))}
                className="w-32 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <Button type="button" onClick={flipCoins}>Flip coins</Button>
            <CopyButton text={coinResults.join(", ")} />
          </div>
          {coinResults.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap gap-2 mb-4">
                {coinResults.map((c, i) => (
                  <span key={i} className="text-3xl" title={c}>
                    {c === "Heads" ? "🪙" : "🌕"}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-amber-50 border border-amber-200 py-3">
                  <p className="text-2xl font-bold text-amber-700">{heads}</p>
                  <p className="text-xs text-amber-600">Heads</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 py-3">
                  <p className="text-2xl font-bold text-slate-700">{tails}</p>
                  <p className="text-xs text-slate-500">Tails</p>
                </div>
                <div className="rounded-xl bg-indigo-50 border border-indigo-200 py-3">
                  <p className="text-2xl font-bold text-indigo-700">{heads}/{coinResults.length}</p>
                  <p className="text-xs text-indigo-600">Heads ratio</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "dice" && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Sides</label>
              <div className="flex rounded-lg border border-slate-200 bg-white p-1">
                {[4, 6, 8, 10, 12, 20].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDieSides(s)}
                    className={`w-9 py-1.5 rounded-md text-xs font-medium transition ${dieSides === s ? "bg-yellow-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    d{s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Rolls</label>
              <input
                type="number"
                min={1}
                value={diceCount}
                onChange={(e) => setDiceCount(Number(e.target.value))}
                className="w-32 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <Button type="button" onClick={rollDice}>Roll {diceCount > 1 ? "dice" : "die"}</Button>
            <CopyButton text={dieResults.join(", ")} />
          </div>
          {dieResults.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {dieResults.map((r, i) => (
                  <span
                    key={i}
                    className="w-12 h-12 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-2xl shadow-inner"
                  >
                    {dieSides === 6 ? DICE_EMOJI[r] : r}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-400">Total: {dieResults.reduce((a, b) => a + b, 0)} · best as single roll: {Math.max(...dieResults)}</p>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-slate-400">In-browser randomness. Not cryptographically secure — fine for games, not for lotteries.</p>
    </div>
  );
}