import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** A tooltip at the cursor that stays on screen: it flips to the left of / above the cursor when it would overflow. */
export function Tooltip({ x, y, children, gap = 14 }: { x: number; y: number; children: ReactNode; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + gap, top: y + gap });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, m = 8;
    let left = x + gap, top = y + gap;
    if (left + width > vw - m) left = x - gap - width;    // flip left of the cursor
    if (top + height > vh - m) top = y - gap - height;    // flip above the cursor
    setPos({ left: Math.max(m, left), top: Math.max(m, top) });
  }, [x, y, gap, children]);
  return <div ref={ref} className="tooltip" style={pos}>{children}</div>;
}
