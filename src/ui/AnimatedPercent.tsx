import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export function AnimatedPercent({ value }: { value: number }) {
  const root = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const element = root.current;
    if (!element || reducedMotion) return;
    let frame = 0;
    let active = false;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && !active) {
          active = true;
          cancelAnimationFrame(frame);
          const started = performance.now();
          const tick = (now: number) => {
            const progress = Math.min(1, (now - started) / 1800);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(value * eased));
            if (progress < 1) frame = requestAnimationFrame(tick);
          };
          setDisplay(0);
          frame = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting) {
          active = false;
          cancelAnimationFrame(frame);
          setDisplay(value);
        }
      }
    }, { root: element.closest('.landing'), rootMargin: '-20% 0px -20% 0px' });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, reducedMotion]);

  return (
    <span ref={root} className="animated-percent" aria-label={`${value}%`}>
      <span aria-hidden="true">{reducedMotion ? value : display}%</span>
    </span>
  );
}
