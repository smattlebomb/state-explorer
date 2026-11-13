import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A button that only fires after being held down for `holdMs`.
 * A bar fills while holding; letting go early cancels.
 */
export function LongPressButton({ onLongPress, holdMs = 3000, children, className = '' }: { onLongPress: () => void; holdMs?: number; children: ReactNode; className?: string }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  const start = () => {
    cancel();
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onLongPress();
    }, holdMs);
  };

  useEffect(() => cancel, []);

  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative overflow-hidden ${className}`}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-rose-200"
        style={holding ? { animation: `fill-bar ${holdMs}ms linear forwards` } : { width: 0 }}
      />
      <span className="relative">{children}</span>
    </button>
  );
}
