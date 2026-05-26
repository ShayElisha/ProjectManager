import { useCallback, useEffect, useState } from "react";

const DEFAULT_OVERSCAN = 8;

export function useVirtualList(
  itemCount: number,
  itemHeight: number,
  scrollRef: React.RefObject<HTMLElement | null>,
  overscan = DEFAULT_OVERSCAN,
) {
  const [range, setRange] = useState({ start: 0, end: Math.min(itemCount, 30) });

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el || itemCount === 0) {
      setRange({ start: 0, end: 0 });
      return;
    }
    const start = Math.max(0, Math.floor(el.scrollTop / itemHeight) - overscan);
    const visible = Math.ceil(el.clientHeight / itemHeight) + overscan * 2;
    const end = Math.min(itemCount, start + visible);
    setRange({ start, end });
  }, [itemCount, itemHeight, overscan, scrollRef]);

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update, scrollRef]);

  useEffect(() => {
    update();
  }, [itemCount, update]);

  return {
    start: range.start,
    end: range.end,
    offsetY: range.start * itemHeight,
    totalHeight: itemCount * itemHeight,
  };
}
