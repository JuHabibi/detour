import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GroupSummary } from "@/application/groups";
import type { EventItem } from "@/data/types";
import {
  formatGroupDateRange,
  groupEventCountLabel,
} from "@/features/account/group-display";
import { takeServerListIfChanged } from "@/features/account/take-server-list-if-changed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
    className?: string;
  }) {
    return createElement("a", { href, ...rest }, children);
  },
}));

vi.mock("next/image", () => ({
  default: function MockImage(props: {
    alt?: string;
    src?: string | { src: string };
  }) {
    const src =
      typeof props.src === "string" ? props.src : (props.src?.src ?? "");
    return createElement("img", { alt: props.alt ?? "", src });
  },
}));

vi.mock("@/app/actions/groups", () => ({
  createGroup: vi.fn(),
  createGroupWithFavorites: vi.fn(),
  renameGroup: vi.fn(),
  deleteGroup: vi.fn(),
  addFavoriteToGroup: vi.fn(),
  addFavoritesToGroup: vi.fn(),
  removeEventFromGroup: vi.fn(),
}));

vi.mock("@/app/actions/favorites", () => ({
  removeFavorite: vi.fn(),
}));

vi.mock("@/features/account/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

import { AccountFavoriteCard } from "@/features/account/components/AccountFavoriteCard";
import { AccountGroupDetail } from "@/features/account/components/AccountGroupDetail";
import { AccountGroupsSection } from "@/features/account/components/AccountGroupsSection";
import { AccountAddToGroupModal } from "@/features/account/components/AccountAddToGroupModal";
import { AccountSignedIn } from "@/features/account/components/AccountSignedIn";

const GROUP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function summary(
  partial: Partial<GroupSummary> & Pick<GroupSummary, "id" | "name">,
): GroupSummary {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-09-16T10:00:00.000Z",
    updatedAt: "2026-09-16T10:00:00.000Z",
    eventCount: 0,
    earliestStartAt: null,
    latestStartAt: null,
    ...partial,
  };
}

function eventItem(
  partial: Partial<EventItem> & Pick<EventItem, "id" | "title">,
): EventItem {
  return {
    category: "Spectacle",
    genre: "Théâtre",
    venue: "Scène",
    city: "Orléans",
    date: "2026-10-12",
    dateLabel: "dim. 12 oct.",
    ...partial,
  };
}

describe("group-display", () => {
  it("libellés compteur + plage de dates", () => {
    expect(groupEventCountLabel(0)).toBe("Aucun événement");
    expect(groupEventCountLabel(1)).toBe("1 événement");
    expect(groupEventCountLabel(3)).toBe("3 événements");

    expect(
      formatGroupDateRange(
        summary({
          id: GROUP_A,
          name: "W",
          earliestStartAt: "2026-10-01T18:00:00.000Z",
          latestStartAt: "2026-10-03T20:00:00.000Z",
        }),
      ),
    ).toMatch(/–/);

    expect(
      formatGroupDateRange(
        summary({
          id: GROUP_A,
          name: "W",
          earliestStartAt: "2026-10-01T12:00:00.000Z",
          latestStartAt: "2026-10-01T18:00:00.000Z",
        }),
      ),
    ).not.toMatch(/–/);
  });
});

describe("AccountGroupsSection (rendu liste)", () => {
  it("affiche nom, compteur, lien Voir le groupe + création", () => {
    const html = renderToStaticMarkup(
      createElement(AccountGroupsSection, {
        groups: [
          summary({
            id: GROUP_A,
            name: "Week-end Loire",
            eventCount: 2,
            earliestStartAt: "2026-10-01T18:00:00.000Z",
            latestStartAt: "2026-10-03T20:00:00.000Z",
          }),
        ],
        onGroupsChange: () => undefined,
      }),
    );

    expect(html).toContain("Mes groupes");
    expect(html).toContain("Week-end Loire");
    expect(html).toContain("2 événements");
    expect(html).toContain("Voir le groupe");
    expect(html).toContain(`/account/groups/${GROUP_A}`);
    expect(html).toContain("Créer un groupe");
    expect(html).toContain("sm:flex-row");
  });

  it("état vide sans régression favoris (section autonome)", () => {
    const html = renderToStaticMarkup(
      createElement(AccountGroupsSection, {
        groups: [],
        onGroupsChange: () => undefined,
      }),
    );
    expect(html).toContain("Aucun groupe");
    expect(html).toContain("Regroupez des favoris");
  });
});

describe("AccountGroupDetail (vue groupe)", () => {
  it("affiche nom, liste events, renommer, supprimer, retirer", () => {
    const html = renderToStaticMarkup(
      createElement(AccountGroupDetail, {
        groupId: GROUP_A,
        initialName: "Week-end Loire",
        initialEvents: [
          eventItem({ id: "e1", title: "Concert jazz" }),
          eventItem({ id: "e2", title: "Expo photo" }),
        ],
      }),
    );

    expect(html).toContain("Week-end Loire");
    expect(html).toContain("2 événements");
    expect(html).toContain("Concert jazz");
    expect(html).toContain("Expo photo");
    expect(html).toContain("Renommer");
    expect(html).toContain("Supprimer le groupe");
    expect(html).toContain("Retirer du groupe");
    expect(html).not.toContain("Ajouter à un groupe");
  });
});

describe("AccountFavoriteCard", () => {
  it("mode normal : lien ICS agenda + actions secondaires inline", () => {
    const html = renderToStaticMarkup(
      createElement(AccountFavoriteCard, {
        event: eventItem({ id: "openagenda:1", title: "Concert" }),
        onRemove: () => undefined,
        onAddToGroup: () => undefined,
      }),
    );

    expect(html).toContain("Ajouter à un groupe");
    expect(html).toContain("Ajouter à mon agenda");
    expect(html).toContain('/api/events/openagenda%3A1/calendar');
    expect(html).toContain("Retirer");
  });

  it("secondaryInMenu : agenda visible (lien), menu … (pas d’inline groupe)", () => {
    const html = renderToStaticMarkup(
      createElement(AccountFavoriteCard, {
        event: eventItem({ id: "e1", title: "Concert" }),
        onRemove: () => undefined,
        onAddToGroup: () => undefined,
        secondaryInMenu: true,
      }),
    );

    expect(html).toContain("Ajouter à mon agenda");
    expect(html).toContain("/api/events/e1/calendar");
    expect(html).toContain("Plus d’actions");
    expect(html).not.toContain("Ajouter à un groupe");
  });

  it("mode sélection : checkbox, pas d’actions ni lien agenda", () => {
    const html = renderToStaticMarkup(
      createElement(AccountFavoriteCard, {
        event: eventItem({ id: "e1", title: "Concert" }),
        selectionMode: true,
        selected: true,
        onToggleSelect: () => undefined,
        onRemove: () => undefined,
        onAddToGroup: () => undefined,
        secondaryInMenu: true,
      }),
    );

    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
    expect(html).not.toContain("Ajouter à mon agenda");
    expect(html).not.toContain("Ajouter à un groupe");
  });

  it("showAgendaLink false : pas de lien agenda", () => {
    const html = renderToStaticMarkup(
      createElement(AccountFavoriteCard, {
        event: eventItem({ id: "e1", title: "Concert" }),
        onRemove: () => undefined,
        showAgendaLink: false,
      }),
    );

    expect(html).not.toContain("Ajouter à mon agenda");
  });
});

describe("AccountAddToGroupModal", () => {
  it("liste les groupes et propose Créer un groupe (single)", () => {
    const html = renderToStaticMarkup(
      createElement(AccountAddToGroupModal, {
        eventIds: ["e1"],
        heading: "Concert jazz",
        groups: [summary({ id: GROUP_A, name: "Week-end Loire" })],
        onClose: () => undefined,
      }),
    );

    expect(html).toContain("Ajouter à un groupe");
    expect(html).toContain("Concert jazz");
    expect(html).toContain("1 favori");
    expect(html).toContain("Week-end Loire");
    expect(html).toContain("Créer un groupe");
    expect(html).toContain("Choisir");
  });

  it("bulk : heading N favoris", () => {
    const html = renderToStaticMarkup(
      createElement(AccountAddToGroupModal, {
        eventIds: ["e1", "e2", "e3"],
        heading: "3 favoris",
        groups: [],
        onClose: () => undefined,
      }),
    );

    expect(html).toContain("3 favoris");
    expect(html).toContain("Aucun groupe pour l’instant");
    expect(html).toContain("Créer un groupe");
  });
});

describe("AccountSignedIn — mode sélection DET-18", () => {
  it("affiche Sélectionner en mode normal (pas de barre sticky)", () => {
    const html = renderToStaticMarkup(
      createElement(AccountSignedIn, {
        user: { name: "A", email: "a@exemple.fr" },
        initialFavorites: [
          eventItem({ id: "e1", title: "Concert" }),
          eventItem({ id: "e2", title: "Expo" }),
        ],
        initialGroups: [],
      }),
    );

    expect(html).toContain("Sélectionner");
    expect(html).not.toContain("Annuler");
    expect(html).not.toContain("sélectionné");
    expect(html).toContain("Favoris");
    expect(html).toContain("Plus d’actions");
  });

  it("état vide favoris : pas de Sélectionner", () => {
    const html = renderToStaticMarkup(
      createElement(AccountSignedIn, {
        user: { name: "A", email: "a@exemple.fr" },
        initialFavorites: [],
        initialGroups: [],
      }),
    );

    expect(html).not.toContain(">Sélectionner<");
  });
});

describe("takeServerListIfChanged (sync post-refresh)", () => {
  it("nouvelle référence props → prendre la liste serveur (eventCount à jour)", () => {
    const v1 = [summary({ id: GROUP_A, name: "W", eventCount: 1 })];
    const v2 = [summary({ id: GROUP_A, name: "W", eventCount: 2 })];
    expect(takeServerListIfChanged(v1, v1)).toBeNull();
    expect(takeServerListIfChanged(v2, v1)).toBe(v2);
    expect(takeServerListIfChanged(v2, v1)?.[0]?.eventCount).toBe(2);
  });
});
