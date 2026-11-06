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
 * Mentions légales — n’affiche jamais d’identité éditeur inventée.
 * Tant que `legalPublisher` n’est pas renseigné, la route répond 404
 * (PR en draft jusqu’à configuration).
 */
export function MentionsLegalesPage() {
  if (!isLegalPublisherReady() || !legalPublisher) {
    notFound();
  }

  const publisher = legalPublisher;

  return (
    <LegalDocumentShell
      title="Mentions légales"
      lead={`Informations légales relatives au site ${LEGAL_SITE.name} (${LEGAL_SITE.origin}).`}
    >
      <LegalSection title="Éditeur">
        <p>
          Le site <strong>{LEGAL_SITE.name}</strong> est édité par{" "}
          <strong>{publisher.name}</strong>
          {publisher.legalStatus ? `, ${publisher.legalStatus}` : null}.
        </p>
        {publisher.registrationNumber ? (
          <p>
            Immatriculation : <strong>{publisher.registrationNumber}</strong>.
          </p>
        ) : null}
        {publisher.addressLines && publisher.addressLines.length > 0 ? (
          <p>
            Adresse :{" "}
            {publisher.addressLines.map((line, index) => (
              <span key={line}>
                {index > 0 ? ", " : null}
                {line}
              </span>
            ))}
            .
          </p>
        ) : null}
        <p>
          Contact :{" "}
          <a href={`mailto:${publisher.email}`}>{publisher.email}</a>.
        </p>
        {publisher.publicationDirector ? (
          <p>
            Directeur de la publication :{" "}
            <strong>{publisher.publicationDirector}</strong>.
          </p>
        ) : null}
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site est hébergé par <strong>{LEGAL_HOST.name}</strong>.
        </p>
        <p>{LEGAL_HOST.addressLines.join(", ")}.</p>
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
