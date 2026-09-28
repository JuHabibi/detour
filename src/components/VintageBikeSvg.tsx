"use client";

/**
 * Vélo années 20 — illustration SVG originale Détour.
 * Les roues tournent via transform (fluide, sans lib d’animation).
 * Contour crème discret pour rester lisible sur feuillages foncés.
 * Décoratif uniquement (aria-hidden côté parent).
 */

const INK = "#111111";
const CREME = "#FFFCF7";
const CORAL = "#F06B4F";
const MINT = "#97C9AB";

export function VintageBikeSvg({
  wheelAngleDeg = 0,
  className,
}: {
  wheelAngleDeg?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 220 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <ellipse cx="110" cy="128" rx="78" ry="6" fill={INK} opacity="0.08" />

      {/* Contour crème — même silhouette, trait un peu plus large sous l’encre */}
      <g
        stroke={CREME}
        strokeWidth={5.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.92}
      >
        <BikeSilhouettePaths />
        <circle cx="58" cy="98" r="26" />
        <circle cx="168" cy="98" r="26" />
        <circle cx="108" cy="92" r="10" />
        <path d="M96 40 C 100 34, 116 34, 120 40 L 118 46 L 98 46 Z" fill={CREME} stroke="none" />
        <path
          d="M156 36 L176 36 L178 52 L154 52 Z"
          fill={CREME}
          stroke={CREME}
          strokeWidth={4}
        />
      </g>

      <circle cx="108" cy="92" r="10" stroke={INK} strokeWidth="2.2" />
      <circle cx="108" cy="92" r="3" fill={INK} />
      <path
        d="M108 92 L148 92"
        stroke={INK}
        strokeWidth="1.6"
        strokeDasharray="2 2"
      />

      <g stroke={INK} strokeWidth={3.2} strokeLinejoin="round" fill="none">
        <BikeSilhouettePaths />
      </g>

      <path
        d="M148 48 L152 28"
        stroke={INK}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M140 24 C 146 18, 158 18, 164 26"
        stroke={CORAL}
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />

      <path
        d="M96 40 C 100 34, 116 34, 120 40 L 118 46 L 98 46 Z"
        fill={INK}
      />
      <path d="M108 46 L108 48" stroke={INK} strokeWidth="2.4" />

      <path
        d="M44 78 A 28 28 0 0 1 72 58"
        stroke={MINT}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      <path
        d="M156 36 L176 36 L178 52 L154 52 Z"
        stroke={INK}
        strokeWidth="1.8"
        fill={CREME}
      />
      <path
        d="M158 40 H174 M158 45 H174 M158 50 H174"
        stroke={INK}
        strokeWidth="1"
        opacity="0.45"
      />
      <path d="M166 36 L166 30" stroke={INK} strokeWidth="1.6" />

      <Wheel cx={58} cy={98} angle={wheelAngleDeg} />
      <Wheel cx={168} cy={98} angle={wheelAngleDeg} />

      <path
        d="M112 50 L144 50"
        stroke={MINT}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

function BikeSilhouettePaths() {
  return (
    <>
      <path d="M72 92 L108 92 L148 48 L108 48 Z" />
      <path d="M108 48 L72 92" />
      <path d="M148 48 L168 92" />
      <path d="M148 48 C 158 58, 166 72, 168 92" />
      <path d="M148 48 L152 28" strokeLinecap="round" />
      <path d="M44 78 A 28 28 0 0 1 72 58" strokeLinecap="round" />
    </>
  );
}

function Wheel({
  cx,
  cy,
  angle,
}: {
  cx: number;
  cy: number;
  angle: number;
}) {
  return (
    <g transform={`rotate(${angle} ${cx} ${cy})`}>
      <circle cx={cx} cy={cy} r="26" stroke={INK} strokeWidth="3" />
      <circle
        cx={cx}
        cy={cy}
        r="22"
        stroke={INK}
        strokeWidth="1"
        opacity="0.35"
      />
      {Array.from({ length: 8 }, (_, i) => {
        const rad = (i * 45 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(rad) * 20}
            y2={cy + Math.sin(rad) * 20}
            stroke={INK}
            strokeWidth="1.2"
            opacity="0.7"
          />
        );
      })}
      <circle cx={cx} cy={cy} r="4" fill={INK} />
    </g>
  );
}
