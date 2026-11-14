import { Mascot } from './Mascot';

/** Big round "Loading the map" card with Ollie. */
export function MapLoading({ text = 'Unrolling the map…' }: { text?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-3xl font-black text-slate-600" role="status">
      <Mascot mood="idle" size={96} />
      {text}
    </div>
  );
}
