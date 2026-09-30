import Image from "next/image";
import Link from "next/link";

/**
 * Empty state Favoris — bloc centré compact :
 * illustration → titre → texte → CTA.
 */
export function AccountEmptyFavorites() {
  return (
    <div className="border-t border-line pt-10 md:pt-12">
      <div className="mx-auto flex w-full max-w-[28rem] flex-col items-center text-center md:max-w-[32rem]">
        <div aria-hidden="true" className="relative w-[16.25rem] md:w-[18.75rem] lg:w-[20rem]">
          <Image
            src="/favorites-heart-collage.png"
            alt=""
            width={320}
            height={240}
            sizes="(min-width: 1024px) 320px, (min-width: 768px) 300px, 260px"
            className="h-auto w-full select-none"
          />
        </div>

        <p className="mt-5 font-editorial text-2xl leading-snug text-ink md:mt-6 md:text-[1.75rem]">
          Aucun détour enregistré
          <br />
          pour le moment.
        </p>
        <p className="mt-3 max-w-sm text-sm leading-6 text-cream-dim md:mt-3.5">
          Parcourez Explorer et gardez ce qui mérite votre attention — vos
          favoris apparaîtront ici.
        </p>
        <Link
          href="/#explorer"
          className="mt-6 inline-flex min-h-11 items-center bg-mint px-5 text-sm font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam md:mt-7"
        >
          Explorer les sorties
        </Link>
      </div>
    </div>
  );
}
