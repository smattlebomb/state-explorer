import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'success' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sky-500 text-white shadow-[0_6px_0_#0369a1] active:shadow-[0_2px_0_#0369a1]',
  secondary: 'bg-white text-slate-800 shadow-[0_6px_0_#94a3b8] active:shadow-[0_2px_0_#94a3b8]',
  success: 'bg-green-500 text-white shadow-[0_6px_0_#15803d] active:shadow-[0_2px_0_#15803d]',
  ghost: 'bg-white/70 text-slate-700',
};

export function BigButton({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`min-h-16 rounded-3xl px-6 text-2xl font-extrabold transition active:translate-y-1 disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Round 64px icon button, e.g. Home or Speaker. */
export function IconButton({ label, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-3xl shadow-[0_4px_0_#94a3b8] transition active:translate-y-1 active:shadow-[0_1px_0_#94a3b8] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TopBar({ onHome, children, right }: { onHome: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-center gap-3 px-3 pt-3 pb-2">
      <IconButton label="Home" onClick={onHome}>
        🏠
      </IconButton>
      <div className="min-w-0 flex-1 text-center">{children}</div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </header>
  );
}

export function Stars({ count, max = 3, size = 'text-5xl' }: { count: number; max?: number; size?: string }) {
  return (
    <div className={`flex justify-center gap-2 ${size}`} aria-label={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? 'pop-in' : 'opacity-25 grayscale'} style={{ animationDelay: `${i * 250}ms` }}>
          ⭐
        </span>
      ))}
    </div>
  );
}
