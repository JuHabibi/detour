import Link from "next/link";

export function AccountEmptyFavorites() {
  return (
    <div className="max-w-lg border-t border-line pt-10 md:pt-12">
      <p className="font-editorial text-2xl leading-snug text-ink md:text-[1.75rem]">
        Aucun détour enregistré pour le moment.
      </p>
      <p className="mt-4 text-sm leading-6 text-cream-dim">
        Parcourez Explorer et gardez ce qui mérite votre attention — vos favoris
        apparaîtront ici.
      </p>
      <Link
        href="/#explorer"
        className="mt-8 inline-flex min-h-11 items-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam"
      >
        Explorer les sorties
      </Link>
    </div>
  );
}
