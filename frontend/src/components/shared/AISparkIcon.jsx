import { useId } from "react";

// The assistant's mark: one large four-point spark with three smaller ones
// around it. Filled rather than stroked (lucide's Sparkles is a line icon), so
// it keeps its weight against the orange-to-pink gradient the AI button and
// header chips are painted with, and reads as a mark rather than one more glyph.
//
// Two tones:
//   "current" — flat `currentColor`, so `text-white` / `text-orange-600` drive
//     it exactly like a lucide icon. Use it in the nav and anywhere the icon is
//     small or has to take the colour of what it sits in.
//   "gloss"   — the dimensional version: a white core falling off to warm gold
//     and pink at the arm tips, a specular highlight and a soft bloom. It is
//     lit for a warm gradient underneath, so it belongs on the orange button and
//     the gradient chips, not on a plain white surface.

const round = (n) => Math.round(n * 100) / 100;

// A four-point star with concave sides. `waist` sets how far the curve controls
// sit from the centre — larger is a fuller, rounder arm, smaller is a spike.
function sparkPath(cx, cy, rx, ry, waist) {
  const wx = round(rx * waist);
  const wy = round(ry * waist);
  const [l, r, t, b] = [round(cx - rx), round(cx + rx), round(cy - ry), round(cy + ry)];
  const [x, y] = [round(cx), round(cy)];
  return (
    `M${x} ${t}` +
    `Q${round(x + wx)} ${round(y - wy)} ${r} ${y}` +
    `Q${round(x + wx)} ${round(y + wy)} ${x} ${b}` +
    `Q${round(x - wx)} ${round(y + wy)} ${l} ${y}` +
    `Q${round(x - wx)} ${round(y - wy)} ${x} ${t}Z`
  );
}

// 24x24, to sit on the same grid as the lucide icons it appears beside. The
// smaller sparks carry a slightly fuller waist — at 2px across, a sharp one
// disappears into the background.
const CORE = sparkPath(10.6, 12.4, 5.8, 6.8, 0.26);
const SPARK_TOP_RIGHT = sparkPath(18.8, 6.4, 2.7, 2.7, 0.28);
const SPARK_BOTTOM_LEFT = sparkPath(5, 19.4, 2, 2, 0.28);
// Sits where the orbit runs, so it steps aside when there is one.
const SPARK_RIGHT = sparkPath(20.4, 16.2, 1.8, 1.8, 0.28);

export default function AISparkIcon({ tone = "current", orbit = false, className = "", ...props }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const shapesId = `ai-spark-${uid}`;
  const fillId = `ai-spark-fill-${uid}`;
  const specId = `ai-spark-spec-${uid}`;
  const bloomId = `ai-spark-bloom-${uid}`;
  const maskId = `ai-spark-mask-${uid}`;

  const gloss = tone === "gloss";
  const paint = gloss ? `url(#${fillId})` : "currentColor";
  const paths = [CORE, SPARK_TOP_RIGHT, SPARK_BOTTOM_LEFT, ...(orbit ? [] : [SPARK_RIGHT])];

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" className={className} {...props}>
      <defs>
        <g id={shapesId}>
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {gloss && (
          <>
            {/* One light source for the whole cluster: white at the core, warm
                gold and then pink as the arms run away from it. Shared by every
                spark in user space, so the small ones are lit by the same lamp
                as the big one instead of each glowing on its own. */}
            <radialGradient id={fillId} cx="9.4" cy="10.6" r="13.5" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.38" stopColor="#ffffff" />
              <stop offset="0.72" stopColor="#ffe4cd" />
              <stop offset="1" stopColor="#ffc0e0" />
            </radialGradient>
            <radialGradient id={specId} cx="9.2" cy="10.4" r="4.2" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <filter id={bloomId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="0.85" />
            </filter>
          </>
        )}

        {/* The mark is one colour along any given arm, so the orbit can't cross
            in front and still read as depth. Instead it breaks around the
            sparks: they are punched out of the ring with a little clearance,
            which is what gives it the sense of passing behind. */}
        {orbit && (
          <mask id={maskId}>
            <rect x="0" y="0" width="24" height="24" fill="white" />
            <g fill="black" stroke="black" strokeWidth="1.6" strokeLinejoin="round">
              {paths.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          </mask>
        )}
      </defs>

      {gloss && <use href={`#${shapesId}`} fill="#ffffff" filter={`url(#${bloomId})`} opacity="0.45" />}

      {orbit && (
        <ellipse
          cx="10.6"
          cy="12.4"
          rx="9.6"
          ry="4.2"
          transform="rotate(20 10.6 12.4)"
          fill="none"
          stroke={paint}
          strokeWidth="1.3"
          strokeLinecap="round"
          mask={`url(#${maskId})`}
          opacity="0.92"
        />
      )}

      {/* Stroked in its own fill: rounded joins take the needle off the arm
          tips, which otherwise vanish at 20px. */}
      <use href={`#${shapesId}`} fill={paint} stroke={paint} strokeWidth="0.4" strokeLinejoin="round" />

      {gloss && <path d={CORE} fill={`url(#${specId})`} />}
    </svg>
  );
}
