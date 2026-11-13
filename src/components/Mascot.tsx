import { motion, useReducedMotion, type TargetAndTransition } from 'framer-motion';

export type MascotMood = 'idle' | 'happy' | 'oops' | 'celebrate';

/**
 * "Ollie", a little explorer owl with a safari hat. Moods:
 * - idle: friendly smile, blinks now and then
 * - happy: squinty smile + blush, small hop
 * - oops: wide eyes looking sideways, little "o" mouth, a sweat drop, a head tilt (never sad or mocking)
 * - celebrate: big grin, wings up, jumps
 * Every animation finishes in about 1s.
 */
export function Mascot({ mood = 'idle', size = 64, className = '' }: { mood?: MascotMood; size?: number; className?: string }) {
  const reduce = useReducedMotion();

  const moves: Record<MascotMood, TargetAndTransition> = reduce
    ? { idle: {}, happy: { scale: [1, 1.05, 1] }, oops: { scale: [1, 0.97, 1] }, celebrate: { scale: [1, 1.08, 1] } }
    : {
        idle: { y: [0, -2, 0], transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } },
        happy: { y: [0, -14, 0, -5, 0], rotate: [0, -4, 4, 0], transition: { duration: 0.7 } },
        oops: { rotate: [0, -12, 9, -5, 0], x: [0, -3, 3, 0], transition: { duration: 0.8 } },
        celebrate: { y: [0, -24, 0, -14, 0], rotate: [0, -8, 8, -4, 0], scale: [1, 1.12, 1, 1.06, 1], transition: { duration: 1.1 } },
      };

  const happyFace = mood === 'happy' || mood === 'celebrate';
  const wingsUp = mood === 'celebrate';

  return (
    <motion.div key={mood} className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} animate={moves[mood]} aria-hidden>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {/* wings */}
        <g fill="#a16207">
          {wingsUp ? (
            <>
              <path d="M22 58 Q6 40 12 26 Q22 40 30 52 Z" />
              <path d="M78 58 Q94 40 88 26 Q78 40 70 52 Z" />
            </>
          ) : (
            <>
              <path d="M20 52 Q10 66 18 80 Q26 70 28 58 Z" />
              <path d="M80 52 Q90 66 82 80 Q74 70 72 58 Z" />
            </>
          )}
        </g>
        {/* body */}
        <ellipse cx="50" cy="62" rx="30" ry="32" fill="#ca8a04" />
        <ellipse cx="50" cy="70" rx="19" ry="21" fill="#fde68a" />
        {/* belly feathers */}
        <path d="M42 66 q4 4 8 0 q4 4 8 0 M42 76 q4 4 8 0 q4 4 8 0" stroke="#d97706" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* feet */}
        <path d="M40 93 l-3 4 M40 93 l0 5 M40 93 l3 4 M60 93 l-3 4 M60 93 l0 5 M60 93 l3 4" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />
        {/* explorer hat */}
        <ellipse cx="50" cy="31" rx="34" ry="7" fill="#65a30d" />
        <path d="M30 31 Q32 12 50 11 Q68 12 70 31 Z" fill="#84cc16" />
        <rect x="30" y="25" width="40" height="5" fill="#3f6212" />
        {/* eyes */}
        <circle cx="38" cy="47" r="12" fill="white" stroke="#92400e" strokeWidth="2" />
        <circle cx="62" cy="47" r="12" fill="white" stroke="#92400e" strokeWidth="2" />
        {happyFace ? (
          <>
            <path d="M31 49 Q38 41 45 49" stroke="#1f2937" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M55 49 Q62 41 69 49" stroke="#1f2937" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <ellipse cx="27" cy="60" rx="5" ry="3" fill="#fb7185" opacity="0.7" />
            <ellipse cx="73" cy="60" rx="5" ry="3" fill="#fb7185" opacity="0.7" />
          </>
        ) : mood === 'oops' ? (
          <>
            <circle cx="42" cy="46" r="5.5" fill="#1f2937" />
            <circle cx="66" cy="46" r="5.5" fill="#1f2937" />
            <circle cx="43.5" cy="44" r="1.8" fill="white" />
            <circle cx="67.5" cy="44" r="1.8" fill="white" />
            {/* raised brows */}
            <path d="M30 32 Q38 28 45 33 M55 33 Q62 28 70 32" stroke="#92400e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* sweat drop */}
            <path d="M80 38 q4 6 0 9 q-4 -3 0 -9 Z" fill="#7dd3fc" stroke="#0284c7" strokeWidth="1" />
          </>
        ) : (
          <>
            <motion.g
              animate={reduce ? undefined : { scaleY: [1, 1, 0.1, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.92, 0.96, 1] }}
              style={{ transformOrigin: '50px 47px' }}
            >
              <circle cx="39" cy="48" r="5.5" fill="#1f2937" />
              <circle cx="61" cy="48" r="5.5" fill="#1f2937" />
              <circle cx="40.5" cy="46" r="1.8" fill="white" />
              <circle cx="62.5" cy="46" r="1.8" fill="white" />
            </motion.g>
          </>
        )}
        {/* beak + mouth */}
        <path d="M46 56 L54 56 L50 63 Z" fill="#f97316" stroke="#c2410c" strokeWidth="1" strokeLinejoin="round" />
        {mood === 'oops' ? (
          <ellipse cx="50" cy="69" rx="3" ry="3.5" fill="#7c2d12" />
        ) : happyFace ? (
          <path d="M42 66 Q50 75 58 66 Z" fill="#7c2d12" />
        ) : (
          <path d="M44 67 Q50 71 56 67" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
      </svg>
    </motion.div>
  );
}
