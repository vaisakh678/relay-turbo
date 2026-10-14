"use client";

import { useTypewriter } from "@/hooks/useTypewriter";

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

const DEMO_TEXTS = DEMO.map((d) => d.text);

// Looping fake stream for the hero, typed out ChatGPT-style
export function StreamDemo() {
  const { index, text, done } = useTypewriter(DEMO_TEXTS);
  const demo = DEMO[index]!;

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
        </span>
        <span className="ml-2 text-muted">{demo.app}</span>
        <span className="ml-auto font-mono text-faint">text/event-stream</span>
      </div>
      <div className="min-h-36 whitespace-pre-wrap p-5 text-[15px] leading-relaxed">
        {text}
        <span className={`caret ml-0.5 ${done ? "" : "caret-solid"}`} />
      </div>
      <div className="flex gap-4 border-t border-line px-4 py-2 font-mono text-[11px] text-faint">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-accent" />
          {done ? "done" : "streaming"}
        </span>
        <span>{Math.ceil(text.length / 4)} tokens</span>
        <span className="ml-auto">prompt {demo.prompt}</span>
      </div>
    </div>
  );
}
