import { notFound } from "next/navigation";
import {
  LEGAL_HOST,
  LEGAL_SITE,
  isLegalPublisherReady,
  legalPublisher,
} from "@/config/legal";
import {
  LegalDocumentShell,
  LegalSection,
} from "@/features/legal/components/LegalDocumentShell";

/**
 * Mentions légales — régime d’édition à titre non professionnel (LCEN art. 1-1 II).
 * Pas d’adresse personnelle publique. Contact e-mail pour les demandes.
 */
export function MentionsLegalesPage() {
  if (!isLegalPublisherReady() || !legalPublisher) {
    notFound();
  }

  return (
    <LegalDocumentShell
      title="Mentions légales"
      lead={`Informations légales relatives au site ${LEGAL_SITE.name} (${LEGAL_SITE.origin}).`}
    >
      <LegalSection title="Édition">
        <p>
          Le site <strong>{LEGAL_SITE.name}</strong> est actuellement édité à
          titre non professionnel. Il est gratuit, sans publicité ni revenus, et
          n’est pas rattaché à une activité commerciale immatriculée.
        </p>
        <p>
          Conformément à l’article 1-1, II, de la loi n° 2004-575 du 21 juin
          2004 pour la confiance dans l’économie numérique, l’identité et le
          domicile de l’éditeur ne sont pas publiés sur cette page. Les éléments
          d’identification personnelle ont été communiqués à l’hébergeur.
        </p>
        <p>
          Contact (y compris demandes relatives aux données personnelles) :{" "}
          <a href={`mailto:${legalPublisher.email}`}>
            {legalPublisher.email}
          </a>
          .
        </p>
        <p>
          Si {LEGAL_SITE.name} devient une activité commerciale, ces mentions
          seront mises à jour en conséquence.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site est hébergé par <strong>{LEGAL_HOST.name}</strong>.
        </p>
        <p>{LEGAL_HOST.addressLines.join(", ")}.</p>
        <p>Téléphone : {LEGAL_HOST.phone}.</p>
        <p>
          Site de l’hébergeur :{" "}
          <a
            href={LEGAL_HOST.website}
            rel="noopener noreferrer"
            target="_blank"
          >
            {LEGAL_HOST.website}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Les éléments graphiques, textes éditoriaux et structure du site{" "}
          {LEGAL_SITE.name} sont protégés. Toute reproduction non autorisée est
          interdite, hors exceptions prévues par la loi.
        </p>
        <p>
          Les informations sur les événements culturels proviennent de sources
          publiques locales (agendas et flux partenaires). Les droits sur ces
          contenus restent ceux de leurs auteurs ou organisateurs respectifs.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
