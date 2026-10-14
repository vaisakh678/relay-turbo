"use client";

import { useEffect, useState } from "react";

const DEMO = [
  {
    app: "🌙 Luna Stories",
    prompt: "v3",
    text: "Once upon a time, in a meadow where the fireflies hummed lullabies, a little fox named Pip curled up beneath the moon and drifted off to sleep.",
  },
  {
    app: "🔥 Roast Bot",
    prompt: "v2",
    text: "Fourteen unfinished side projects? That is not a portfolio, that is a graveyard tour. But hey, at least you start things.",
  },
  {
    app: "💨 Puff Logger",
    prompt: "v1",
    text: "Three days under ten puffs is real progress. Try a five-minute walk before the next craving. They usually fade within that window.",
  },
];

// Looping fake token stream for the hero
export function StreamDemo() {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const [fading, setFading] = useState(false);
  const demo = DEMO[i];
  const words = demo.text.split(" ");
  const done = n >= words.length;

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (fading) {
      t = setTimeout(() => {
        setI((i + 1) % DEMO.length);
        setN(0);
        setFading(false);
      }, 350);
    } else if (done) {
      t = setTimeout(() => setFading(true), 2200);
    } else {
      const prev = DEMO[i].text.split(" ")[n - 1] ?? "";
      const pause = /[.,?!]$/.test(prev) ? 180 : 0;
      t = setTimeout(() => setN(n + 1), (n === 0 ? 500 : 45 + Math.random() * 55) + pause);
    }
    return () => clearTimeout(t);
  }, [i, n, done, fading]);

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
        </span>
        <span className={`ml-2 text-muted transition-opacity duration-300 ${fading ? "opacity-0" : ""}`}>{demo.app}</span>
        <span className="ml-auto font-mono text-faint">text/event-stream</span>
      </div>
      <div className={`min-h-36 p-5 text-[15px] leading-relaxed transition-opacity duration-300 ${fading ? "opacity-0" : ""}`}>
        {words.slice(0, n).map((w, k) => (
          <span key={`${i}-${k}`} className="token">
            {k > 0 && " "}
            {w}
          </span>
        ))}
        <span className={`caret ml-0.5 ${done ? "" : "caret-solid"}`} />
      </div>
      <div className="flex gap-4 border-t border-line px-4 py-2 font-mono text-[11px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-accent" />
          {done ? "done" : "streaming"}
        </span>
        <span>{n} tokens</span>
        <span className="ml-auto">prompt {demo.prompt}</span>
      </div>
    </div>
  );
}
