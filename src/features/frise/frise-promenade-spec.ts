/**
 * Contrat technique — bande-promenade Frise.
 *
 * Utilisé par FriseLandscapeDecor pour couvrir la largeur réelle du track.
 *
 * Invariants produit :
 * - Le scroll horizontal et le vélo SVG restent inchangés.
 * - Pas de 2ᵉ ligne de sol : les panneaux se raccordent à la route viewport existante.
 * - Couverture = f(largeur réelle du track), pas un quota fixe de panneaux.
 */

/** Hauteurs d’affichage CSS (bande paysage, sous les cartes). */
export const FRISE_PROMENADE_BAND_HEIGHT = {
  /** Mobile étroit — ~9.5rem */
  mobileRem: 9.5,
  /** Desktop — ~14rem */
  desktopRem: 14,
} as const;

/**
 * Canvas art recommandé (px @1x design, exporter WebP @1x et @2x si besoin).
 * Affichage = hauteur de bande ; largeur panneau = width × (bandPx / height).
 */
export const FRISE_PROMENADE_ARTBOARD = {
  /** Hauteur utile du collage (hors marge transparente optionnelle). */
  heightPx: 720,
  /**
   * Largeur d’un panneau-séquence.
   * À 14rem (≈224px) d’affichage → largeur affichée ≈ 224 × (1120/720) ≈ 348px.
   */
  widthPx: 1120,
  /**
   * Marge basse transparente (px artboard) pour laisser voir la route du vélo
   * et éviter une 2ᵉ ligne de sol. Le collage ne doit pas peindre un chemin
   * horizontal continu dans cette zone.
   */
  roadClearancePx: 96,
  /**
   * Zone de raccord latéral (px artboard de chaque côté) : découpe / alpha,
   * prévue pour un chevauchement à l’affichage.
   */
  seamOverlapArtPx: 48,
} as const;

/** Chevauchement horizontal à l’affichage entre deux panneaux (px CSS). */
export const FRISE_PROMENADE_SEAM_OVERLAP_PX = 12;

/** Accents 1er plan — densité max (1 accent / N px de track). */
export const FRISE_PROMENADE_FOREGROUND = {
  minGapPx: 420,
  maxPerTrack: 6,
} as const;

export type FrisePromenadeSequenceId =
  | "loire"
  | "ville"
  | "jardin";

export type FrisePromenadeVariant = "a" | "b";

export type FrisePromenadePanelId =
  `${FrisePromenadeSequenceId}-${FrisePromenadeVariant}`;

/**
 * Ordre narratif d’une « balade » puis variantes B pour le 2ᵉ cycle.
 * Ne pas répéter A-A-A : on alterne le cycle complet.
 */
export const FRISE_PROMENADE_CYCLE: readonly FrisePromenadePanelId[] = [
  "loire-a",
  "ville-a",
  "jardin-a",
  "loire-b",
  "ville-b",
  "jardin-b",
] as const;

export type FrisePromenadePanelAsset = {
  id: FrisePromenadePanelId;
  sequence: FrisePromenadeSequenceId;
  variant: FrisePromenadeVariant;
  /** Chemin public attendu — WebP avec canal alpha. */
  src: string;
  widthPx: number;
  heightPx: number;
};

/**
 * Manifeste des assets attendus (fichiers à livrer).
 * Intégration UI uniquement quand tous les `src` existent.
 */
export const FRISE_PROMENADE_PANEL_ASSETS: readonly FrisePromenadePanelAsset[] =
  FRISE_PROMENADE_CYCLE.map((id) => {
    const [sequence, variant] = id.split("-") as [
      FrisePromenadeSequenceId,
      FrisePromenadeVariant,
    ];
    return {
      id,
      sequence,
      variant,
      src: `/images/frise/promenade-${id}.webp`,
      widthPx: FRISE_PROMENADE_ARTBOARD.widthPx,
      heightPx: FRISE_PROMENADE_ARTBOARD.heightPx,
    };
  });

export type FrisePromenadeForegroundKind = "leaf" | "lamp" | "burst";

export const FRISE_PROMENADE_FOREGROUND_ASSETS: readonly {
  kind: FrisePromenadeForegroundKind;
  src: string;
  /** Largeur art max recommandée. */
  maxWidthPx: number;
}[] = [
  {
    kind: "leaf",
    src: "/images/frise/promenade-fg-leaf.webp",
    maxWidthPx: 220,
  },
  {
    kind: "lamp",
    src: "/images/frise/promenade-fg-lamp.webp",
    maxWidthPx: 160,
  },
  {
    kind: "burst",
    src: "/images/frise/promenade-fg-burst.webp",
    maxWidthPx: 180,
  },
] as const;

export type FrisePromenadePlannedPanel = {
  /** Index dans le cycle (0…n-1), pour clé React stable. */
  index: number;
  panelId: FrisePromenadePanelId;
  /** Décalage gauche en px dans la bande (après chevauchements). */
  offsetPx: number;
  /** Largeur affichée du panneau. */
  displayWidthPx: number;
};

export type FrisePromenadeCoveragePlan = {
  trackWidthPx: number;
  bandHeightPx: number;
  panelDisplayWidthPx: number;
  panelStepPx: number;
  panelCount: number;
  panels: FrisePromenadePlannedPanel[];
  /** Largeur totale couverte (≥ trackWidthPx). */
  coveredWidthPx: number;
};

/**
 * Largeur affichée d’un panneau pour une hauteur de bande donnée.
 * Préserve le ratio artboard (pas de cover).
 */
export function promenadePanelDisplayWidth(
  bandHeightPx: number,
  art = FRISE_PROMENADE_ARTBOARD,
): number {
  if (bandHeightPx <= 0) return 0;
  return (art.widthPx / art.heightPx) * bandHeightPx;
}

/**
 * Pas horizontal entre origines de panneaux (= largeur affichée − overlap).
 */
export function promenadePanelStepPx(
  bandHeightPx: number,
  overlapPx: number = FRISE_PROMENADE_SEAM_OVERLAP_PX,
  art = FRISE_PROMENADE_ARTBOARD,
): number {
  const width = promenadePanelDisplayWidth(bandHeightPx, art);
  return Math.max(1, width - overlapPx);
}

/**
 * Calcule combien de panneaux placer pour couvrir toute la largeur du track.
 * Adapte le nombre à la largeur réelle — frise courte ou longue.
 */
export function planPromenadeCoverage(params: {
  trackWidthPx: number;
  /** Hauteur CSS convertie en px (ex. 14rem → 224 si root 16px). */
  bandHeightPx: number;
  overlapPx?: number;
  cycle?: readonly FrisePromenadePanelId[];
}): FrisePromenadeCoveragePlan {
  const {
    trackWidthPx,
    bandHeightPx,
    overlapPx = FRISE_PROMENADE_SEAM_OVERLAP_PX,
    cycle = FRISE_PROMENADE_CYCLE,
  } = params;

  const safeTrack = Math.max(0, trackWidthPx);
  const displayWidthPx = promenadePanelDisplayWidth(bandHeightPx);
  const stepPx = promenadePanelStepPx(bandHeightPx, overlapPx);

  if (safeTrack === 0 || displayWidthPx === 0 || cycle.length === 0) {
    return {
      trackWidthPx: safeTrack,
      bandHeightPx,
      panelDisplayWidthPx: displayWidthPx,
      panelStepPx: stepPx,
      panelCount: 0,
      panels: [],
      coveredWidthPx: 0,
    };
  }

  // Premier panneau couvre [0, displayWidth]. Chaque suivant ajoute `stepPx`.
  // covered(n) = displayWidth + (n - 1) * step  ≥ trackWidth
  const panelCount = Math.max(
    1,
    Math.ceil((safeTrack - displayWidthPx) / stepPx) + 1,
  );

  const panels: FrisePromenadePlannedPanel[] = [];
  for (let i = 0; i < panelCount; i += 1) {
    panels.push({
      index: i,
      panelId: cycle[i % cycle.length]!,
      offsetPx: i * stepPx,
      displayWidthPx,
    });
  }

  const coveredWidthPx =
    panelCount === 0
      ? 0
      : displayWidthPx + (panelCount - 1) * stepPx;

  return {
    trackWidthPx: safeTrack,
    bandHeightPx,
    panelDisplayWidthPx: displayWidthPx,
    panelStepPx: stepPx,
    panelCount,
    panels,
    coveredWidthPx,
  };
}

/* -------------------------------------------------------------------------- */
/* Continuité Loire → quai → entrée → motif bouclable                         */
/* -------------------------------------------------------------------------- */

export type FriseRiveSceneId =
  | "loire-a"
  | "quai-pop-a-vers-rive"
  | "quai-rive-entree"
  | "rive-motif-bouclable";

export type FriseRiveSceneAsset = {
  id: FriseRiveSceneId;
  src: string;
  canvasW: number;
  canvasH: number;
};

/** Manifeste — dimensions source des WebP livrés. */
export const FRISE_RIVE_SCENES = {
  loire: {
    id: "loire-a",
    src: "/images/frise/promenade-loire-a.webp",
    canvasW: 1564,
    canvasH: 1006,
  },
  quay: {
    id: "quai-pop-a-vers-rive",
    src: "/images/frise/promenade-quai-pop-a-vers-rive.webp",
    canvasW: 1509,
    canvasH: 1006,
  },
  entree: {
    id: "quai-rive-entree",
    src: "/images/frise/promenade-quai-rive-entree.webp",
    canvasW: 1000,
    canvasH: 1006,
  },
  motif: {
    id: "rive-motif-bouclable",
    src: "/images/frise/promenade-rive-motif-bouclable.webp",
    canvasW: 1356,
    canvasH: 1024,
  },
} as const satisfies Record<string, FriseRiveSceneAsset>;

/**
 * Chevauchements en px source (largeur du panneau de référence).
 * Affichage = source × (bandHeightPx / canvasH_ref).
 */
export const FRISE_RIVE_OVERLAP_SOURCE_PX = {
  /** Avant la fin de Loire — Loire devant le quai. */
  loireOverQuay: 200,
  /** Avant la fin du quai — quai devant l’entrée. */
  quayOverEntree: 180,
  /** Avant la fin de l’entrée — entrée devant le 1er motif. */
  entreeOverMotif: 140,
} as const;

export type FriseRivePlacedScene = {
  id: FriseRiveSceneId;
  src: string;
  leftPx: number;
  widthPx: number;
  heightPx: number;
  zIndex: number;
  canvasW: number;
  canvasH: number;
};

export type FriseRiveContinuumPlan = {
  trackWidthPx: number;
  bandHeightPx: number;
  scenes: FriseRivePlacedScene[];
  motifCount: number;
  /** Fin droite du dernier élément décoratif. */
  coveredWidthPx: number;
  overlapsPx: {
    loireQuay: number;
    quayEntree: number;
    entreeMotif: number;
  };
};

function riveDisplayWidthPx(
  scene: FriseRiveSceneAsset,
  bandHeightPx: number,
): number {
  if (bandHeightPx <= 0) return 0;
  return (scene.canvasW / scene.canvasH) * bandHeightPx;
}

function riveOverlapPx(
  sourceOverlapPx: number,
  refCanvasH: number,
  bandHeightPx: number,
): number {
  if (bandHeightPx <= 0 || refCanvasH <= 0) return 0;
  return sourceOverlapPx * (bandHeightPx / refCanvasH);
}

/**
 * Place Loire → quai → entrée → motifs bouclés pour couvrir `trackWidthPx`
 * sans allonger le scroll (le décor reste en absolute hors flux).
 */
export function planRiveContinuum(params: {
  trackWidthPx: number;
  bandHeightPx: number;
}): FriseRiveContinuumPlan {
  const trackWidthPx = Math.max(0, params.trackWidthPx);
  const bandHeightPx = Math.max(0, params.bandHeightPx);
  const { loire, quay, entree, motif } = FRISE_RIVE_SCENES;

  const loireW = riveDisplayWidthPx(loire, bandHeightPx);
  const quayW = riveDisplayWidthPx(quay, bandHeightPx);
  const entreeW = riveDisplayWidthPx(entree, bandHeightPx);
  const motifW = riveDisplayWidthPx(motif, bandHeightPx);

  const oLQ = riveOverlapPx(
    FRISE_RIVE_OVERLAP_SOURCE_PX.loireOverQuay,
    loire.canvasH,
    bandHeightPx,
  );
  const oQE = riveOverlapPx(
    FRISE_RIVE_OVERLAP_SOURCE_PX.quayOverEntree,
    quay.canvasH,
    bandHeightPx,
  );
  const oEM = riveOverlapPx(
    FRISE_RIVE_OVERLAP_SOURCE_PX.entreeOverMotif,
    entree.canvasH,
    bandHeightPx,
  );

  const loireLeft = 0;
  const quayLeft = loireW - oLQ;
  const entreeLeft = quayLeft + quayW - oQE;
  const motifStart = entreeLeft + entreeW - oEM;

  let motifCount = 0;
  if (bandHeightPx > 0 && motifW > 0 && motifStart < trackWidthPx) {
    motifCount = Math.max(
      1,
      Math.ceil((trackWidthPx - motifStart) / motifW),
    );
  }

  const scenes: FriseRivePlacedScene[] = [];

  // Arrière → avant (z croissant) pour le chevauchement.
  for (let i = 0; i < motifCount; i += 1) {
    scenes.push({
      id: motif.id,
      src: motif.src,
      leftPx: motifStart + i * motifW,
      widthPx: motifW,
      heightPx: bandHeightPx,
      zIndex: 0,
      canvasW: motif.canvasW,
      canvasH: motif.canvasH,
    });
  }

  scenes.push({
    id: entree.id,
    src: entree.src,
    leftPx: entreeLeft,
    widthPx: entreeW,
    heightPx: bandHeightPx,
    zIndex: 1,
    canvasW: entree.canvasW,
    canvasH: entree.canvasH,
  });

  scenes.push({
    id: quay.id,
    src: quay.src,
    leftPx: quayLeft,
    widthPx: quayW,
    heightPx: bandHeightPx,
    zIndex: 2,
    canvasW: quay.canvasW,
    canvasH: quay.canvasH,
  });

  scenes.push({
    id: loire.id,
    src: loire.src,
    leftPx: loireLeft,
    widthPx: loireW,
    heightPx: bandHeightPx,
    zIndex: 3,
    canvasW: loire.canvasW,
    canvasH: loire.canvasH,
  });

  const coveredWidthPx =
    motifCount > 0
      ? motifStart + motifCount * motifW
      : entreeLeft + entreeW;

  return {
    trackWidthPx,
    bandHeightPx,
    scenes,
    motifCount,
    coveredWidthPx,
    overlapsPx: {
      loireQuay: oLQ,
      quayEntree: oQE,
      entreeMotif: oEM,
    },
  };
}

/**
 * Positions d’accents 1er plan le long du track (px), sans surcharger.
 */
export function planPromenadeForegroundOffsets(
  trackWidthPx: number,
  options: {
    minGapPx?: number;
    maxPerTrack?: number;
  } = {},
): number[] {
  const minGap = options.minGapPx ?? FRISE_PROMENADE_FOREGROUND.minGapPx;
  const maxCount =
    options.maxPerTrack ?? FRISE_PROMENADE_FOREGROUND.maxPerTrack;
  if (trackWidthPx < minGap) return [];

  const offsets: number[] = [];
  // Départ un peu après le bord gauche pour ne pas coincer sous le mois.
  let cursor = Math.min(minGap * 0.6, trackWidthPx * 0.15);
  while (cursor < trackWidthPx - 80 && offsets.length < maxCount) {
    offsets.push(Math.round(cursor));
    cursor += minGap;
  }
  return offsets;
}
