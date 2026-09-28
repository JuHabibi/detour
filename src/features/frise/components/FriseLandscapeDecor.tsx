"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  planRiveContinuum,
  type FriseRiveContinuumPlan,
} from "@/features/frise/landscape/frise-promenade-spec";

/**
 * Continuité graphique frise : Loire-A → quai → entrée → motif bouclé.
 *
 * Le décor est absolute (hors flux) : il ne allonge pas le scroll.
 * Largeur du track mesurée sur le parent (contenu événements).
 * Ruban SVG conservé ci-dessous, désactivé.
 */

/** Flag — false : continuité WebP active, pas de ruban SVG. */
export const FRISE_BASE_RIBBON_ENABLED = false;

/**
 * Voile crème discret sur le paysage composé (une seule opacité de groupe).
 * Laisse voir le fond foam/paper à travers les WebP sans rectangle derrière
 * les zones transparentes, et sans altérer les chevauchements entre scènes.
 */
export const FRISE_LANDSCAPE_VEIL_OPACITY = 0.86;

/** Décalage bas du paysage (chevauche légèrement la route). */
const SCENE_BOTTOM_NUDGE = {
  mobileRem: -0.75,
  desktopRem: -1,
} as const;

/** Conservé pour le ruban SVG (désactivé). */
const RIBBON_HEIGHT = {
  mobileRem: 22,
  desktopRem: 28,
} as const;

/** Fallback géométrie ruban (désactivé) — largeur Loire @ ~32rem. */
const LOIRE_DISPLAY_W_DESKTOP = Math.round(32 * 16 * (1564 / 1006));

export function FriseLandscapeDecor({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      data-frise-promenade-prototype="loire-quai-entree-motif"
      data-frise-scenes="loire-a,quai-pop-a-vers-rive,quai-rive-entree,rive-motif-bouclable"
      data-frise-base-ribbon={
        FRISE_BASE_RIBBON_ENABLED ? "loire-to-quay-v2" : "off"
      }
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 top-0 z-0 overflow-visible",
        className,
      )}
    >
      {FRISE_BASE_RIBBON_ENABLED ? (
        <>
          <BaseRibbon
            className="md:hidden"
            heightRem={RIBBON_HEIGHT.mobileRem}
            bottomRem={SCENE_BOTTOM_NUDGE.mobileRem}
          />
          <BaseRibbon
            className="hidden md:block"
            heightRem={RIBBON_HEIGHT.desktopRem}
            bottomRem={SCENE_BOTTOM_NUDGE.desktopRem}
          />
        </>
      ) : null}

      {/* Une seule bande : hauteur = piste parente (viewport), pas de rem fixes. */}
      <SceneRow />
    </div>
  );
}

function SceneRow() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [trackWidthPx, setTrackWidthPx] = useState(0);
  const [bandHeightPx, setBandHeightPx] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const track = host.parentElement;
    if (!track) return;

    const measure = () => {
      const tw = Math.round(track.getBoundingClientRect().width);
      const bh = Math.round(host.getBoundingClientRect().height);
      setTrackWidthPx((prev) => (prev === tw ? prev : tw));
      setBandHeightPx((prev) => (prev === bh ? prev : bh));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const plan: FriseRiveContinuumPlan | null =
    trackWidthPx > 0 && bandHeightPx > 0
      ? planRiveContinuum({ trackWidthPx, bandHeightPx })
      : null;

  return (
    <div
      ref={hostRef}
      className={cn(
        "absolute inset-x-0 overflow-x-clip",
        // Remplit la piste + léger débord bas (route) — proportions WebP via bandHeightPx
        "bottom-[-0.75rem] h-[calc(100%+0.75rem)] md:bottom-[-1rem] md:h-[calc(100%+1rem)]",
      )}
      data-frise-scene-row
      data-frise-band-h={bandHeightPx || undefined}
      data-frise-track-w={trackWidthPx || undefined}
      data-frise-motif-count={plan?.motifCount ?? undefined}
      data-frise-covered-w={
        plan ? Math.round(plan.coveredWidthPx) : undefined
      }
    >
      {plan ? (
        <div
          data-frise-landscape-veil
          data-frise-landscape-veil-opacity={FRISE_LANDSCAPE_VEIL_OPACITY}
          className="absolute inset-0"
          style={{ opacity: FRISE_LANDSCAPE_VEIL_OPACITY }}
        >
          {plan.scenes.map((scene, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- décor WebP alpha hors LCP
            <img
              key={`${scene.id}-${index}-${Math.round(scene.leftPx)}`}
              src={scene.src}
              alt=""
              width={scene.canvasW}
              height={scene.canvasH}
              decoding="async"
              loading={scene.id === "loire-a" ? "eager" : "lazy"}
              draggable={false}
              data-frise-scene={scene.id}
              data-frise-scene-left={Math.round(scene.leftPx)}
              className="absolute bottom-0 max-w-none select-none object-contain object-left-bottom"
              style={{
                left: `${scene.leftPx}px`,
                width: `${scene.widthPx}px`,
                height: `${scene.heightPx}px`,
                zIndex: scene.zIndex,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const FRISE_LOIRE_PROTOTYPE_METRICS = {
  order: [
    "loire-a",
    "quai-pop-a-vers-rive",
    "quai-rive-entree",
    "rive-motif-bouclable",
  ] as const,
  /** Paysage = 100 % hauteur de piste (voir FRISE_TRACK_HEIGHT_CLASS). */
  landscapeFillsTrack: true,
  bottomNudgeRem: SCENE_BOTTOM_NUDGE,
  baseRibbon: {
    enabled: FRISE_BASE_RIBBON_ENABLED,
    variant: "loire-to-quay-v2",
    heightRem: RIBBON_HEIGHT,
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Ruban SVG (désactivé) — conservé pour réversibilité du prototype           */
/* -------------------------------------------------------------------------- */

function BaseRibbon({
  heightRem,
  bottomRem,
  className,
}: {
  heightRem: number;
  bottomRem: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      setWidthPx((prev) => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vbH = 360;
  const geometry = widthPx > 0 ? buildRibbonGeometry(widthPx, vbH) : null;
  const ids = {
    water: `friseW-${uid}`,
    bank: `friseB-${uid}`,
    tone: `friseT-${uid}`,
    grain: `friseG-${uid}`,
  };
  const loireEnd = geometry?.loireEnd ?? LOIRE_DISPLAY_W_DESKTOP;

  return (
    <div
      ref={hostRef}
      data-frise-base-ribbon-el
      className={cn("absolute inset-x-0 z-0 overflow-visible", className)}
      style={{ bottom: `${bottomRem}rem`, height: `${heightRem}rem` }}
    >
      {geometry ? (
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${widthPx} ${vbH}`}
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <linearGradient
              id={ids.water}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={widthPx}
              y2="0"
            >
              <stop offset="0" stopColor="#8fc4e4" stopOpacity="0.95" />
              <stop
                offset={String(Math.min(1, loireEnd / widthPx))}
                stopColor="#8fc4e4"
                stopOpacity="0.9"
              />
              <stop
                offset={String(Math.min(1, geometry.transitionEnd / widthPx))}
                stopColor="#ddeff7"
                stopOpacity="0.72"
              />
              <stop offset="1" stopColor="#ddeff7" stopOpacity="0.32" />
            </linearGradient>
            <linearGradient
              id={ids.bank}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2={widthPx}
              y2="0"
            >
              <stop offset="0" stopColor="#97c9ab" stopOpacity="0.95" />
              <stop
                offset={String(Math.min(1, loireEnd / widthPx))}
                stopColor="#D9E3D6"
                stopOpacity="0.95"
              />
              <stop
                offset={String(Math.min(1, (loireEnd + 500) / widthPx))}
                stopColor="#ebe6dc"
                stopOpacity="0.96"
              />
              <stop offset="1" stopColor="#f6ead9" stopOpacity="0.9" />
            </linearGradient>
            <pattern
              id={ids.tone}
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1.4" cy="1.4" r="0.85" fill="#111111" opacity="0.075" />
              <circle cx="4.9" cy="4.6" r="0.55" fill="#111111" opacity="0.045" />
            </pattern>
            <pattern
              id={ids.grain}
              width="52"
              height="52"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="9" cy="14" r="1.15" fill="#3f3c37" opacity="0.04" />
              <circle cx="28" cy="33" r="0.9" fill="#3f3c37" opacity="0.035" />
              <circle cx="41" cy="11" r="1.25" fill="#111111" opacity="0.028" />
              <circle cx="18" cy="44" r="0.7" fill="#55524c" opacity="0.04" />
            </pattern>
          </defs>
          {geometry.hills.map((h) => (
            <path key={h.key} d={h.d} fill={h.fill} opacity={h.opacity} />
          ))}
          <path fill={`url(#${ids.water})`} d={geometry.waterPath} />
          {geometry.glints.map((g) => (
            <path key={g.key} fill={g.fill} opacity={g.opacity} d={g.d} />
          ))}
          <path fill={`url(#${ids.bank})`} d={geometry.bankPath} />
          {geometry.foliage.map((f) => (
            <path key={f.key} d={f.d} fill={f.fill} opacity={f.opacity} />
          ))}
          {geometry.slabs.map((s) => (
            <path key={s.key} fill={s.fill} opacity={s.opacity} d={s.d} />
          ))}
          <g stroke="#111111" strokeOpacity="0.12" strokeWidth="1.1" fill="none">
            {geometry.joints.map((j) => (
              <path key={j.key} d={j.d} />
            ))}
          </g>
          {geometry.mounds.map((m) => (
            <ellipse
              key={m.key}
              cx={m.cx}
              cy={m.cy}
              rx={m.rx}
              ry={m.ry}
              fill={m.fill}
              opacity={m.opacity}
            />
          ))}
          {geometry.bollards.map((b) => (
            <rect
              key={b.key}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx="1"
              fill="#55524c"
              opacity={b.opacity}
            />
          ))}
          {geometry.cables.map((c) => (
            <path
              key={c.key}
              d={c.d}
              fill="none"
              stroke="#3f3c37"
              strokeOpacity="0.22"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          ))}
          <path
            fill="none"
            stroke="#111111"
            strokeOpacity="0.14"
            strokeWidth="1.4"
            d={geometry.ridgePath}
          />
          <rect
            x="0"
            y={vbH * 0.35}
            width={widthPx}
            height={vbH * 0.65}
            fill={`url(#${ids.tone})`}
          />
          <rect
            x="0"
            y={vbH * 0.35}
            width={widthPx}
            height={vbH * 0.65}
            fill={`url(#${ids.grain})`}
          />
        </svg>
      ) : null}
    </div>
  );
}

type RibbonGeom = {
  loireEnd: number;
  transitionEnd: number;
  waterPath: string;
  bankPath: string;
  ridgePath: string;
  glints: { key: string; d: string; fill: string; opacity: number }[];
  slabs: { key: string; d: string; fill: string; opacity: number }[];
  joints: { key: string; d: string }[];
  mounds: {
    key: string;
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    fill: string;
    opacity: number;
  }[];
  bollards: {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    opacity: number;
  }[];
  cables: { key: string; d: string }[];
  hills: { key: string; d: string; fill: string; opacity: number }[];
  foliage: { key: string; d: string; fill: string; opacity: number }[];
};

function ribbonRand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function densityAt(x: number, loireEnd: number, transitionEnd: number) {
  if (x < loireEnd * 0.55) return 0.15;
  if (x < loireEnd)
    return 0.35 + ((x - loireEnd * 0.55) / (loireEnd * 0.45)) * 0.45;
  if (x < loireEnd + 700) return 1;
  if (x < transitionEnd) {
    return (
      1 -
      ((x - loireEnd - 700) / Math.max(1, transitionEnd - loireEnd - 700)) *
        0.75
    );
  }
  return 0.22;
}

function buildRibbonGeometry(widthPx: number, vbH: number): RibbonGeom {
  const loireEnd = Math.min(widthPx, LOIRE_DISPLAY_W_DESKTOP);
  const transitionEnd = Math.min(widthPx, loireEnd + 1400);
  const baseY = vbH * 0.58;
  const step = 72;
  const topPts: { x: number; y: number }[] = [];
  for (let x = 0; x <= widthPx + step; x += step) {
    const n = ribbonRand(x * 0.17 + 3);
    const n2 = ribbonRand(x * 0.09 + 9);
    const d = densityAt(x, loireEnd, transitionEnd);
    const y = baseY - d * (vbH * 0.42) + n * 18 - n2 * 10;
    topPts.push({
      x: Math.min(x, widthPx),
      y: Math.max(28, Math.min(vbH * 0.72, y)),
    });
  }
  if (topPts[topPts.length - 1]!.x < widthPx) {
    topPts.push({ x: widthPx, y: topPts[topPts.length - 1]!.y });
  }
  const ridgePath = topPts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const bankPath = `${ridgePath} L${widthPx} ${vbH * 0.82} L0 ${vbH * 0.8} Z`;
  let waterPath = `M0 ${vbH * 0.7}`;
  for (let x = 0; x <= widthPx; x += 120) {
    const n = ribbonRand(x * 0.11 + 1);
    const d = densityAt(x, loireEnd, transitionEnd);
    const y = vbH * (0.68 - d * 0.04) + Math.sin(x / 150) * 8 + n * 7;
    waterPath += ` L${Math.min(x, widthPx).toFixed(1)} ${y.toFixed(1)}`;
  }
  waterPath += ` L${widthPx} ${vbH} L0 ${vbH} Z`;
  const hills: RibbonGeom["hills"] = [];
  for (let i = 0, hx = loireEnd - 80; hx < transitionEnd + 80; i += 1) {
    const n = ribbonRand(i * 6.7);
    const d = densityAt(hx, loireEnd, transitionEnd);
    if (d < 0.35) {
      hx += 140 + n * 80;
      continue;
    }
    const w = 160 + n * 140;
    const peak = vbH * (0.12 + (1 - d) * 0.15) + n * 16;
    const left = hx;
    const right = Math.min(hx + w, widthPx);
    hills.push({
      key: `hill-${i}`,
      fill: i % 2 === 0 ? "#5a92b5" : "#7eb3d4",
      opacity: 0.72 + d * 0.22,
      d: `M${left.toFixed(1)} ${(vbH * 0.62).toFixed(1)} Q${((left + right) / 2).toFixed(1)} ${peak.toFixed(1)} ${right.toFixed(1)} ${(vbH * 0.62).toFixed(1)} Z`,
    });
    hx += w * 0.48 + n * 30;
  }
  const foliage: RibbonGeom["foliage"] = [];
  const foliageFills = [
    "#5f8f6e",
    "#97c9ab",
    "#6f9e7f",
    "#3f6b4c",
    "#e8c85a",
    "#D9E3D6",
  ];
  for (let i = 0, fx = loireEnd - 160; fx < transitionEnd; i += 1) {
    const n = ribbonRand(i * 9.1);
    const d = densityAt(fx, loireEnd, transitionEnd);
    if (d < 0.35) {
      fx += 70 + n * 50;
      continue;
    }
    const cx = fx + n * 36;
    const cy = vbH * (0.42 - d * 0.16) + n * 24;
    const rx = 48 + n * 62 * d;
    const ry = 40 + n * 48 * d;
    foliage.push({
      key: `fol-${i}`,
      fill: foliageFills[i % foliageFills.length]!,
      opacity: 0.78 + d * 0.2,
      d: blobPath(cx, cy, rx, ry, i),
    });
    if (d > 0.55) {
      foliage.push({
        key: `fol2-${i}`,
        fill: foliageFills[(i + 2) % foliageFills.length]!,
        opacity: 0.65 + d * 0.2,
        d: blobPath(cx + rx * 0.45, cy + 8, rx * 0.7, ry * 0.75, i + 40),
      });
    }
    fx += 52 + n * 48;
  }
  const slabFills = ["#ebe6dc", "#f6ead9", "#fffcf7", "#D9E3D6"];
  const slabs: RibbonGeom["slabs"] = [];
  const joints: RibbonGeom["joints"] = [];
  let x = loireEnd * 0.5;
  let slabI = 0;
  while (x < widthPx - 40) {
    const n = ribbonRand(slabI * 7.3 + 2);
    const n2 = ribbonRand(slabI * 3.1 + 5);
    const d = densityAt(x, loireEnd, transitionEnd);
    const w = 70 + n * (55 + d * 40);
    const skew = 5 + n2 * 10;
    const y0 = vbH * (0.55 - d * 0.12) + n * 10;
    const y1 = vbH * 0.78 + n2 * 6;
    const x2 = Math.min(x + w, widthPx - 8);
    slabs.push({
      key: `slab-${slabI}`,
      fill: slabFills[slabI % slabFills.length]!,
      opacity: 0.55 + d * 0.4,
      d: `M${x.toFixed(1)} ${y0.toFixed(1)} L${x2.toFixed(1)} ${(y0 - 3 + n2 * 4).toFixed(1)} L${(x2 + skew * 0.3).toFixed(1)} ${y1.toFixed(1)} L${(x - skew * 0.2).toFixed(1)} ${(y1 + 2).toFixed(1)} Z`,
    });
    joints.push({
      key: `joint-${slabI}`,
      d: `M${x2.toFixed(1)} ${(y0 - 3 + n2 * 4).toFixed(1)} L${(x2 + skew * 0.3).toFixed(1)} ${y1.toFixed(1)}`,
    });
    x += w + 8 + n * (20 + (1 - d) * 40);
    slabI += 1;
  }
  const glints: RibbonGeom["glints"] = [];
  for (
    let i = 0, gx = 30;
    gx < widthPx;
    i += 1, gx += 180 + ribbonRand(i + 4) * 140
  ) {
    const n = ribbonRand(i * 5.5);
    const d = densityAt(gx, loireEnd, transitionEnd);
    glints.push({
      key: `glint-${i}`,
      fill: i % 2 === 0 ? "#ddeff7" : "#fffcf7",
      opacity: (0.15 + d * 0.25) * (0.7 + n * 0.3),
      d: `M${gx.toFixed(1)} ${(vbH * 0.82).toFixed(1)} L${(gx + 90 + n * 40).toFixed(1)} ${(vbH * 0.78 + n * 6).toFixed(1)} L${(gx + 120 + n * 30).toFixed(1)} ${(vbH * 0.88).toFixed(1)} L${(gx + 20).toFixed(1)} ${(vbH * 0.9).toFixed(1)} Z`,
    });
  }
  const mounds: RibbonGeom["mounds"] = [];
  for (let i = 0, mx = 80; mx < transitionEnd + 200 && mx < widthPx; i += 1) {
    const n = ribbonRand(i * 8.2);
    const d = densityAt(mx, loireEnd, transitionEnd);
    mounds.push({
      key: `mound-${i}`,
      cx: mx,
      cy: vbH * (0.62 - d * 0.06) + n * 8,
      rx: 22 + n * 28 * Math.max(0.4, d),
      ry: 9 + n * 10 * Math.max(0.4, d),
      fill: i % 2 === 0 ? "#97c9ab" : "#D9E3D6",
      opacity: 0.25 + d * 0.5,
    });
    mx += 100 + n * 90;
  }
  const bollards: RibbonGeom["bollards"] = [];
  const cables: RibbonGeom["cables"] = [];
  for (let i = 0, bx = loireEnd * 0.35; bx < widthPx - 60; i += 1) {
    const n = ribbonRand(i * 11.1);
    const d = densityAt(bx, loireEnd, transitionEnd);
    bollards.push({
      key: `bol-${i}`,
      x: bx,
      y: vbH * (0.58 - d * 0.08) + n * 8,
      w: 6 + (n > 0.5 ? 2 : 0),
      h: 22 + n * 10 + d * 16,
      opacity: 0.3 + d * 0.35,
    });
    if (n > 0.4 && d > 0.35) {
      cables.push({
        key: `cable-${i}`,
        d: `M${bx.toFixed(1)} ${(vbH * 0.64).toFixed(1)} Q${(bx + 28).toFixed(1)} ${(vbH * 0.58 + n * 8).toFixed(1)} ${(bx + 55 + n * 20).toFixed(1)} ${(vbH * 0.66).toFixed(1)}`,
      });
    }
    bx += 160 + n * 160 + (1 - d) * 120;
  }
  return {
    loireEnd,
    transitionEnd,
    waterPath,
    bankPath,
    ridgePath,
    glints,
    slabs,
    joints,
    mounds,
    bollards,
    cables,
    hills,
    foliage,
  };
}

function blobPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
) {
  const pts: string[] = [];
  const steps = 7;
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const n = 0.75 + ribbonRand(seed * 13 + i) * 0.5;
    const x = cx + Math.cos(a) * rx * n;
    const y = cy + Math.sin(a) * ry * n;
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `${pts.join(" ")} Z`;
}
