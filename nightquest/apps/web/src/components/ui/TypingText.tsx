import { useEffect, useMemo, useRef, useState } from 'react';
import { typing } from '../../lib/motion';
import { cn } from '../../lib/cn';

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}

type Props = {
  text: string;
  speed?: number;
  className?: string;
  loading?: boolean;
  onComplete?: () => void;
};

export function TypingText({ text, speed = typing.normal, className, loading, onComplete }: Props) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(reducedMotion ? text : '');
  const [showCursor, setShowCursor] = useState(Boolean(text));
  const startTime = useRef(0);
  const canSkip = useMemo(() => performance.now() - startTime.current >= typing.minTapUnlock, [visible]);

  useEffect(() => {
    if (reducedMotion) {
      setVisible(text);
      setShowCursor(false);
      onComplete?.();
      return;
    }

    setVisible('');
    setShowCursor(Boolean(text));
    if (!text) {
      return;
    }

    startTime.current = performance.now();
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisible(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
        window.setTimeout(() => setShowCursor(false), typing.cursorFadeAfter);
        onComplete?.();
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [onComplete, reducedMotion, speed, text]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!reducedMotion && canSkip && visible.length < text.length) {
          setVisible(text);
          window.setTimeout(() => setShowCursor(false), typing.cursorFadeAfter);
          onComplete?.();
        }
      }}
      className={cn('w-full text-left', className)}
    >
      <span>{visible}</span>
      {loading ? <span className="animate-pulse">...</span> : null}
      {showCursor ? <span className="animate-pulse">|</span> : null}
    </button>
  );
}
