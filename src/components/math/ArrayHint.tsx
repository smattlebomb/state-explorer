/**
 * A picture of a × b: `a` rows of `b` dots ("3 rows of 4"). Dots in a row
 * are grouped in fives with a little gap so 12 × 12 stays countable, and the
 * whole picture scales to fit (never tiny dots on a phone).
 */
export function ArrayHint({ a, b, className = '' }: { a: number; b: number; className?: string }) {
  const total = a * b;
  const caption = `${a} ${a === 1 ? 'row' : 'rows'} of ${b} = ${total}`;
  if (a === 0 || b === 0) {
    return (
      <div className={`rounded-3xl bg-white/90 p-4 text-center ${className}`} role="img" aria-label={caption}>
        <div className="text-2xl font-black text-slate-700">
          {a === 0 ? `0 rows of ${b}` : `${a} ${a === 1 ? 'row' : 'rows'} of 0`} = 0
        </div>
        <div className="text-lg font-bold text-slate-500">Anything times 0 is 0. Nothing to count!</div>
      </div>
    );
  }
  const cell = 24;
  const r = 9;
  const groupGap = 10;
  const xOf = (j: number) => j * cell + Math.floor(j / 5) * groupGap + cell / 2;
  const width = xOf(b - 1) + cell / 2;
  const height = a * cell + Math.floor((a - 1) / 5) * groupGap;
  const yOf = (i: number) => i * cell + Math.floor(i / 5) * groupGap + cell / 2;
  return (
    <figure className={`flex flex-col items-center rounded-3xl bg-white/90 p-3 ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        style={{ maxWidth: Math.min(420, width * 1.6), maxHeight: '34vh' }}
        role="img"
        aria-label={caption}
      >
        {Array.from({ length: a }, (_, i) =>
          Array.from({ length: b }, (_, j) => <circle key={`${i}-${j}`} cx={xOf(j)} cy={yOf(i)} r={r} fill={i % 2 === 0 ? '#38bdf8' : '#a78bfa'} />),
        )}
      </svg>
      <figcaption className="mt-1 text-center text-2xl font-black text-slate-700">{caption}</figcaption>
    </figure>
  );
}
