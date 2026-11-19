import { useEffect } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
/** Answers go up to 144; 3 digits is plenty. */
export const MAX_DIGITS = 3;

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

/**
 * Big on-screen number pad: 1–9, Clear, 0, ⌫, then a wide Check button.
 * Every key is at least 64px tall. A hardware keyboard works too (digits,
 * Backspace, Enter), which helps on an iPad with a keyboard case.
 */
export function NumberPad({ value, onChange, onSubmit, disabled = false }: Props) {
  const press = (d: string) => {
    if (disabled || value.length >= MAX_DIGITS) return;
    // No leading zeros ("07"): a typed 0 replaces a lone 0.
    onChange(value === '0' ? d : value + d);
  };
  const back = () => !disabled && onChange(value.slice(0, -1));
  const clear = () => !disabled && onChange('');

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') onSubmit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const key = 'flex min-h-16 min-w-0 items-center justify-center rounded-3xl bg-white text-4xl font-black text-slate-800 shadow-[0_5px_0_#94a3b8] transition active:translate-y-1 active:shadow-none disabled:opacity-40 sm:min-h-20';
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-3" role="group" aria-label="Number pad">
      {KEYS.map((d) => (
        <button key={d} type="button" aria-label={d} disabled={disabled} onClick={() => press(d)} className={key}>
          {d}
        </button>
      ))}
      <button type="button" aria-label="Clear" disabled={disabled} onClick={clear} className={`${key} text-2xl text-slate-600`}>
        Clear
      </button>
      <button type="button" aria-label="0" disabled={disabled} onClick={() => press('0')} className={key}>
        0
      </button>
      <button type="button" aria-label="Delete" disabled={disabled} onClick={back} className={`${key} text-3xl`}>
        ⌫
      </button>
      <button
        type="button"
        aria-label="Check answer"
        disabled={disabled || value === ''}
        onClick={onSubmit}
        className="col-span-3 flex min-h-20 items-center justify-center rounded-3xl bg-green-500 text-3xl font-black text-white shadow-[0_6px_0_#15803d] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
      >
        Check ✓
      </button>
    </div>
  );
}
