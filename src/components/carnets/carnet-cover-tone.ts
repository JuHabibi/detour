/** Tons de couverture — 4 teintes proto bien distinctes, puis extensions Détour. */
export type CarnetCoverTone = {
  bg: string;
  ink: string;
  soft: string;
};

/** Ordre volontaire : moutarde → terracotta → sauge → bleu (comme le proto). */
const TONES: CarnetCoverTone[] = [
  { bg: "bg-sun", ink: "text-ink", soft: "bg-sun-soft" },
  { bg: "bg-coral", ink: "text-foam", soft: "bg-peach-soft" },
  { bg: "bg-mint", ink: "text-ink", soft: "bg-mint-soft" },
  { bg: "bg-sky", ink: "text-ink", soft: "bg-sky-soft" },
  { bg: "bg-lilac", ink: "text-ink", soft: "bg-lilac-soft" },
  { bg: "bg-blush", ink: "text-ink", soft: "bg-blush-soft" },
  { bg: "bg-peach", ink: "text-ink", soft: "bg-peach-soft" },
  { bg: "bg-sauge", ink: "text-ink", soft: "bg-mint-soft" },
];

const ROTATIONS = [
  "-rotate-[2.5deg]",
  "rotate-[1.8deg]",
  "-rotate-[1.2deg]",
  "rotate-[2.2deg]",
] as const;

/**
 * Couleur par index d’affichage — garantit la diversité dans la bibliothèque
 * (évite les collisions d’un hash sur UUID).
 */
export function carnetCoverTone(indexOrId: number | string): CarnetCoverTone {
  const index =
    typeof indexOrId === "number"
      ? indexOrId
      : hashId(indexOrId);
  return TONES[mod(index, TONES.length)]!;
}

export function carnetCoverRotation(indexOrId: number | string): string {
  const index =
    typeof indexOrId === "number"
      ? indexOrId
      : hashId(indexOrId);
  return ROTATIONS[mod(index, ROTATIONS.length)]!;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function hashId(id: string): number {
  // FNV-1a 32-bit — mieux réparti que le polynôme naïf sur des UUID.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
