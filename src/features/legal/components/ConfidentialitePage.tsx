import Link from "next/link";
import {
  CONFIDENTIALITE_PATH,
  LEGAL_HOST,
  LEGAL_SITE,
  MENTIONS_LEGALES_PATH,
  legalPublisher,
} from "@/config/legal";
import {
  LegalDocumentShell,
  LegalSection,
} from "@/features/legal/components/LegalDocumentShell";

export function ConfidentialitePage() {
  const contactEmail = legalPublisher.email;

  return (
    <LegalDocumentShell
      title="Confidentialité"
      lead={`Comment ${LEGAL_SITE.name} traite vos données personnelles lorsque vous utilisez le site.`}
    >
      <LegalSection title="Responsable du traitement">
        <p>
          Le responsable du traitement des données liées à votre compte et à vos
          contenus personnels sur {LEGAL_SITE.name} est{" "}
          <strong>{legalPublisher.name}</strong>. Contact :{" "}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
        <p>
          Les mentions relatives à l’édition du site et à l’hébergeur figurent
          sur la page{" "}
          <Link href={MENTIONS_LEGALES_PATH}>Mentions légales</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Données que nous traitons">
        <p>Selon votre usage du site, nous pouvons traiter :</p>
        <ul>
          <li>
            <strong>Compte</strong> : nom, adresse e-mail, indication de
            vérification de l’e-mail, et éventuellement une image de profil
            fournie par un fournisseur d’identité.
          </li>
          <li>
            <strong>Authentification</strong> : mot de passe stocké sous forme
            non réversible lorsque vous créez un compte e-mail ; ou identifiants
            techniques liés à Google si vous choisissez la connexion Google
            (lorsque cette option est activée).
          </li>
          <li>
            <strong>Contenus personnels</strong> : événements mis en favoris,
            carnets et appartenance d’événements à ces carnets.
          </li>
          <li>
            <strong>Sécurité et sessions</strong> : jetons de session, et le cas
            échéant adresse IP et agent utilisateur associés à la session, ainsi
            que des compteurs techniques de limitation d’abus.
          </li>
          <li>
            <strong>E-mails transactionnels</strong> : adresse e-mail et liens
            à usage unique pour vérifier une adresse, réinitialiser un mot de
            passe ou confirmer la suppression du compte.
          </li>
        </ul>
        <p>
          La consultation publique du radar culturel (listes d’événements) ne
          nécessite pas de compte.
        </p>
      </LegalSection>

      <LegalSection title="Finalités">
        <ul>
          <li>Créer et gérer votre compte.</li>
          <li>Vous permettre d’enregistrer des favoris et des carnets.</li>
          <li>
            Sécuriser l’accès (sessions, vérification e-mail, limitation
            d’abus).
          </li>
          <li>
            Vous envoyer uniquement les e-mails nécessaires au compte (pas de
            newsletter marketing dans le fonctionnement actuel).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies et stockage du navigateur">
        <p>
          {LEGAL_SITE.name} utilise des cookies et un stockage local{" "}
          <strong>nécessaires au fonctionnement des comptes</strong>,
          notamment :
        </p>
        <ul>
          <li>
            cookies de session d’authentification (Better Auth) pour rester
            connecté ;
          </li>
          <li>
            un cache de session de courte durée pour limiter les allers-retours
            techniques ;
          </li>
          <li>
            un cookie temporaire après suppression de compte, uniquement pour
            afficher la confirmation une fois ;
          </li>
          <li>
            un stockage de session du navigateur pour mémoriser, le temps d’une
            connexion, l’intention d’ajouter un favori après authentification.
          </li>
        </ul>
        <p>
          Ces mécanismes ne servent pas à de la publicité ni à mesurer
          l’audience.
        </p>
        <p>
          <strong>Mesure d’audience :</strong> PostHog n’est plus initialisé par
          l’application. Aucun nouvel identifiant analytics n’est créé par
          Détour. D’anciennes données ou cookies PostHog peuvent encore exister
          chez des visiteurs ou chez le prestataire suite à une période
          antérieure ; cela ne signifie pas que la collecte a repris.
        </p>
      </LegalSection>

      <LegalSection title="Prestataires">
        <p>
          Des prestataires techniques traitent des données pour le compte de{" "}
          {LEGAL_SITE.name}, dans la limite de leur rôle :
        </p>
        <ul>
          <li>
            <strong>{LEGAL_HOST.name}</strong> : hébergement et infrastructure
            du site.
          </li>
          <li>
            <strong>Base de données PostgreSQL</strong> (souvent fournie via
            Neon en production) : stockage des comptes, sessions, favoris et
            carnets.
          </li>
          <li>
            <strong>Resend</strong> : envoi des e-mails transactionnels lorsque
            ce service est configuré.
          </li>
          <li>
            <strong>Google</strong> : uniquement si vous utilisez la connexion
            Google et que cette option est activée.
          </li>
          <li>
            <strong>OpenAI</strong> : peut être utilisé côté serveur pour aider
            au classement éditorial d’événements publics ; ce traitement ne
            porte pas sur le contenu de votre compte.
          </li>
        </ul>
        <p>
          Les régions exactes d’hébergement et les éventuels transferts hors
          Union européenne dépendent de la configuration de chaque prestataire ;
          elles ne sont pas déduites automatiquement ici.
        </p>
      </LegalSection>

      <LegalSection title="Durées de conservation">
        <ul>
          <li>
            Données de compte, favoris et carnets : conservées tant que le
            compte existe.
          </li>
          <li>
            Sessions : limitées dans le temps (expiration technique côté
            authentification).
          </li>
          <li>
            Jetons e-mail (vérification, reset, suppression) : durée courte et
            usage unique selon le flux concerné.
          </li>
          <li>
            Après suppression du compte : les données personnelles du compte,
            sessions, favoris et carnets associés sont effacées ; le catalogue
            public d’événements n’est pas concerné.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Conformément au RGPD, vous pouvez demander l’accès, la rectification,
          l’effacement, la limitation ou la portabilité de vos données, ainsi
          qu’exercer une opposition lorsque le cadre légal le permet.
        </p>
        <p>
          La suppression du compte est disponible dans les paramètres du compte
          (confirmation par e-mail). Pour les autres demandes, contactez{" "}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la CNIL (
          <a
            href="https://www.cnil.fr"
            rel="noopener noreferrer"
            target="_blank"
          >
            www.cnil.fr
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="Mises à jour">
        <p>
          Cette page décrit le fonctionnement actuel de {LEGAL_SITE.name}. Elle
          pourra être mise à jour si les traitements évoluent. Version publiée
          avec l’adresse{" "}
          <Link href={CONFIDENTIALITE_PATH}>{CONFIDENTIALITE_PATH}</Link>.
        </p>
      </LegalSection>
    </LegalDocumentShell>
  );
}
