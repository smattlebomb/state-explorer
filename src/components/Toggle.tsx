/** A big, labeled on/off switch row (≥64px tall). */
export function Toggle({ label, sub, checked, onChange, emoji }: { label: string; sub?: string; checked: boolean; onChange: (on: boolean) => void; emoji?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-16 w-full items-center gap-4 rounded-3xl bg-white px-5 py-3 text-left shadow-[0_4px_0_#94a3b8] transition active:translate-y-1 active:shadow-[0_1px_0_#94a3b8]"
    >
      {emoji && <span className="text-4xl">{emoji}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-2xl font-extrabold text-slate-800">{label}</span>
        {sub && <span className="block text-lg font-semibold text-slate-500">{sub}</span>}
      </span>
      <span className={`relative h-10 w-[4.5rem] shrink-0 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow transition-all ${checked ? 'left-9' : 'left-1'}`} />
      </span>
      <span className={`w-12 text-xl font-black ${checked ? 'text-green-600' : 'text-slate-400'}`}>{checked ? 'ON' : 'OFF'}</span>
    </button>
  );
}
