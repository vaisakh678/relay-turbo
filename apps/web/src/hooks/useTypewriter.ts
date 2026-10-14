import { useEffect, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * ChatGPT-style typing: reveals each text a character or two at a time with
 * a slightly uneven cadence and a beat after punctuation, holds the finished
 * text, then moves straight on to the next one (no fade). With reduced motion
 * the full text shows at once.
 */
export function useTypewriter(texts: string[], { charMs = 18, holdMs = 2200, startMs = 450 } = {}) {
  const [reduced] = useState(prefersReducedMotion)
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(0)
  const current = texts[index] ?? ''

  useEffect(() => {
    // Code points, so an emoji is never split in half
    const length = Array.from(current).length
    const next = () => {
      setIndex((i) => (i + 1) % texts.length)
      setCount(0)
    }

    if (reduced) {
      const t = setTimeout(next, holdMs * 2)
      return () => clearTimeout(t)
    }
    if (count >= length) {
      const t = setTimeout(next, holdMs)
      return () => clearTimeout(t)
    }
    const prev = Array.from(current)[count - 1] ?? ''
    const pause = count === 0 ? startMs : /[.!?]/.test(prev) ? 160 : /[,;:]/.test(prev) ? 80 : 0
    const step = Math.random() < 0.35 ? 2 : 1
    const t = setTimeout(() => setCount((c) => Math.min(length, c + step)), charMs + Math.random() * charMs + pause)
    return () => clearTimeout(t)
  }, [current, count, reduced, texts.length, charMs, holdMs, startMs])

  const chars = Array.from(current)
  return {
    index,
    text: reduced ? current : chars.slice(0, count).join(''),
    done: reduced || count >= chars.length,
  }
}
