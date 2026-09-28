import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  EventGroupMembership,
  GroupSummary,
} from "@/application/groups";
import type { EventItem } from "@/data/types";
import {
  formatGroupDateRange,
  groupEventCountLabel,
} from "@/features/account/groups/group-display";
import {
  buildMembershipMap,
  countFavoritesInGroup,
  countFavoritesWithoutCarnet,
  filterFavoriteIds,
  replaceEventMemberships,
} from "@/features/account/groups/membership-index";
import { carnetCoverTone } from "@/features/account/groups/carnet-cover-tone";
import { takeServerListIfChanged } from "@/features/account/take-server-list-if-changed";
import {
  nextSelectedIds,
  selectAllIds,
  selectAllToggleLabel,
  shouldShowBulkBar,
} from "@/features/account/groups/group-selection";

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

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

import { AccountFavoriteCard } from "@/features/account/components/AccountFavoriteCard";
import { AccountGroupDetail } from "@/features/account/components/AccountGroupDetail";
import { AccountGroupEventCard } from "@/features/account/components/AccountGroupEventCard";
import { AccountCarnetsLibrary } from "@/features/account/components/AccountCarnetsLibrary";
import { AccountCarnetCover } from "@/features/account/components/AccountCarnetCover";
import { AccountAddToGroupModal } from "@/features/account/components/AccountAddToGroupModal";
import { AccountCarnetFormModal } from "@/features/account/components/AccountCarnetFormModal";
import { AccountSignedIn } from "@/features/account/components/AccountSignedIn";
import { AppModal } from "@/components/ui/AppModal";

const GROUP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

function membership(
  partial: EventGroupMembership,
): EventGroupMembership {
  return partial;
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

describe("membership-index", () => {
  const memberships = [
    membership({ eventId: "e1", groupId: GROUP_A, groupName: "Week-end" }),
    membership({ eventId: "e1", groupId: GROUP_B, groupName: "Jazz" }),
    membership({ eventId: "e2", groupId: GROUP_A, groupName: "Week-end" }),
  ];

  it("filtre Tous / Sans carnet / par carnet", () => {
    const ids = ["e1", "e2", "e3"];
    expect(filterFavoriteIds(ids, memberships, { kind: "all" })).toEqual(ids);
    expect(filterFavoriteIds(ids, memberships, { kind: "none" })).toEqual([
      "e3",
    ]);
    expect(
      filterFavoriteIds(ids, memberships, {
        kind: "group",
        groupId: GROUP_A,
      }),
    ).toEqual(["e1", "e2"]);
  });

  it("compteurs + pastilles multi-carnets", () => {
    expect(countFavoritesWithoutCarnet(["e1", "e2", "e3"], memberships)).toBe(
      1,
    );
    expect(countFavoritesInGroup(["e1", "e2", "e3"], memberships, GROUP_A)).toBe(
      2,
    );
    const map = buildMembershipMap(memberships, [
      { id: GROUP_A },
      { id: GROUP_B },
    ]);
    expect(map.get("e1")?.map((c) => c.groupName)).toEqual([
      "Week-end",
      "Jazz",
    ]);
    expect(map.get("e1")?.map((c) => c.toneIndex)).toEqual([0, 1]);
  });

  it("replaceEventMemberships resync après Valider", () => {
    const next = replaceEventMemberships(memberships, ["e1"], [
      { groupId: GROUP_B, groupName: "Jazz" },
    ]);
    expect(next.filter((m) => m.eventId === "e1")).toEqual([
      { eventId: "e1", groupId: GROUP_B, groupName: "Jazz" },
    ]);
    expect(next.filter((m) => m.eventId === "e2")).toHaveLength(1);
  });
});

describe("carnet-cover-tone", () => {
  it("cycle distinct par index d’affichage", () => {
    expect(carnetCoverTone(0).bg).toBe("bg-sun");
    expect(carnetCoverTone(1).bg).toBe("bg-coral");
    expect(carnetCoverTone(2).bg).toBe("bg-mint");
    expect(carnetCoverTone(3).bg).toBe("bg-sky");
    expect(carnetCoverTone(4).bg).toBe("bg-lilac");
    expect(carnetCoverTone(0)).toEqual(carnetCoverTone(8));
  });

  it("hash id reste stable (pastilles hors liste)", () => {
    expect(carnetCoverTone(GROUP_A)).toEqual(carnetCoverTone(GROUP_A));
    expect(carnetCoverTone(GROUP_A).bg).toMatch(/^bg-/);
  });
});

describe("AccountCarnetsLibrary", () => {
  it("affiche bibliothèque, création, menu couverture", () => {
    const html = renderToStaticMarkup(
      createElement(AccountCarnetsLibrary, {
        groups: [
          summary({
            id: GROUP_A,
            name: "Week-end Loire",
            eventCount: 2,
          }),
        ],
        memberships: [],
        activeGroupId: null,
        onSelectGroup: () => undefined,
        onGroupsChange: () => undefined,
        onMembershipsChange: () => undefined,
      }),
    );

    expect(html).toContain("Week-end Loire");
    expect(html).toContain("2 événements");
    expect(html).toContain("+ Créer un carnet");
    expect(html).toContain("Options du carnet Week-end Loire");
    expect(html).not.toContain("Créer une nouvelle collection");
    expect(html).not.toContain("La bibliothèque");
  });

  it("état vide + Voir tous si plus de 4 carnets", () => {
    const empty = renderToStaticMarkup(
      createElement(AccountCarnetsLibrary, {
        groups: [],
        memberships: [],
        activeGroupId: null,
        onSelectGroup: () => undefined,
        onGroupsChange: () => undefined,
        onMembershipsChange: () => undefined,
      }),
    );
    expect(empty).toContain("Créez un premier carnet");

    const many = Array.from({ length: 5 }, (_, i) =>
      summary({
        id: `${i}aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
        name: `Carnet ${i}`,
        eventCount: i,
      }),
    );
    const html = renderToStaticMarkup(
      createElement(AccountCarnetsLibrary, {
        groups: many,
        memberships: [],
        activeGroupId: null,
        onSelectGroup: () => undefined,
        onGroupsChange: () => undefined,
        onMembershipsChange: () => undefined,
      }),
    );
    expect(html).toContain("Voir tous les carnets (5)");
    expect(html).toContain("Carnet 0");
    expect(html).toContain("Carnet 3");
    expect(html).toContain("Carnet 4");
    // Desktop borné : pas de 5e couverture dans la grille md:grid (slice 4)
    expect(html).toContain("hidden grid-cols-2");
  });
});

describe("AccountCarnetCover", () => {
  it("couverture + bouton options (menu fermé par défaut)", () => {
    const html = renderToStaticMarkup(
      createElement(AccountCarnetCover, {
        group: summary({ id: GROUP_A, name: "Jazz", eventCount: 1 }),
        toneIndex: 0,
        onSelect: () => undefined,
        onRename: () => undefined,
        onDelete: () => undefined,
        onExport: () => undefined,
      }),
    );
    expect(html).toContain("Jazz");
    expect(html).toContain("1 événement");
    expect(html).toContain("Options du carnet Jazz");
    expect(html).toContain("aria-haspopup");
  });
});

describe("AccountGroupDetail (vue carnet)", () => {
  it("affiche grille éditoriale, sélection discrète, options secondaires", () => {
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
    expect(html).toContain("Choisir plusieurs événements");
    expect(html).toContain("Ajouter tout à mon agenda");
    expect(html).toContain(
      "Ajoutez plusieurs événements à l’agenda ou retirez-les du carnet.",
    );
    expect(html).toContain("Options du carnet");
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("lg:grid-cols-3");
    expect(html).toContain("max-w-[72rem]");
    expect(html).toContain("Plus d’actions");
    expect(html).not.toContain(">Annuler<");
    expect(html).not.toContain("Tout sélectionner");
    expect(html).not.toContain("Nouveau nom du carnet");
    expect(html).not.toContain("Supprimer le carnet");
  });

  it("état vide : pas de grille ni sélection", () => {
    const html = renderToStaticMarkup(
      createElement(AccountGroupDetail, {
        groupId: GROUP_A,
        initialName: "Vide",
        initialEvents: [],
      }),
    );
    expect(html).toContain("Ce carnet est vide");
    expect(html).not.toContain("Choisir plusieurs événements");
    expect(html).not.toContain("lg:grid-cols-3");
  });
});

describe("AccountGroupEventCard", () => {
  it("card collection compacte : image 16/10, badge, titre, menu …", () => {
    const html = renderToStaticMarkup(
      createElement(AccountGroupEventCard, {
        event: eventItem({
          id: "e1",
          title: "Concert jazz",
          image: "https://example.com/p.jpg",
        }),
        onRemove: () => undefined,
      }),
    );
    expect(html).toContain("Concert jazz");
    expect(html).toContain("Plus d’actions");
    expect(html).toContain("aspect-[16/10]");
    expect(html).not.toContain('type="checkbox"');
  });

  it("mode sélection : checkbox discrète, pas de menu", () => {
    const html = renderToStaticMarkup(
      createElement(AccountGroupEventCard, {
        event: eventItem({ id: "e1", title: "Concert" }),
        selectionMode: true,
        selected: true,
        onToggleSelect: () => undefined,
        onRemove: () => undefined,
      }),
    );
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
    expect(html).toContain("border-coral");
    expect(html).toContain("size-[18px]");
    expect(html).not.toContain("Plus d’actions");
    expect(html).not.toContain("ring-2");
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

    expect(html).toContain("Ranger dans un carnet");
    expect(html).toContain("Ajouter à mon agenda");
    expect(html).toContain("/api/events/openagenda%3A1/calendar");
    expect(html).toContain("Retirer");
  });

  it("pastilles carnets + secondaryInMenu", () => {
    const html = renderToStaticMarkup(
      createElement(AccountFavoriteCard, {
        event: eventItem({ id: "e1", title: "Concert" }),
        carnets: [
          { groupId: GROUP_A, groupName: "Week-end Loire", toneIndex: 0 },
        ],
        onRemove: () => undefined,
        onAddToGroup: () => undefined,
        secondaryInMenu: true,
      }),
    );

    expect(html).toContain("Week-end Loire");
    expect(html).toContain("Ajouter à mon agenda");
    expect(html).toContain("/api/events/e1/calendar");
    expect(html).toContain("Plus d’actions");
    expect(html).not.toContain("Ranger dans un carnet");
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
    expect(html).not.toContain("Ranger dans un carnet");
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

describe("AppModal", () => {
  it("expose eyebrow, titre, children et footer", () => {
    const html = renderToStaticMarkup(
      createElement(AppModal, {
        eyebrow: "Mes carnets",
        title: "Créer une nouvelle collection.",
        description: "Donnez-lui une intention.",
        onClose: () => undefined,
        footer: createElement("button", { type: "button" }, "Créer le carnet"),
        children: createElement("p", null, "Champ nom"),
      }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Mes carnets");
    expect(html).toContain("Créer une nouvelle collection.");
    expect(html).toContain("Donnez-lui une intention.");
    expect(html).toContain("Champ nom");
    expect(html).toContain("Créer le carnet");
  });
});

describe("AccountCarnetFormModal", () => {
  it("mode création : titre et champ nom", () => {
    const html = renderToStaticMarkup(
      createElement(AccountCarnetFormModal, {
        mode: { kind: "create" },
        onClose: () => undefined,
      }),
    );
    expect(html).toContain("Créer une nouvelle collection.");
    expect(html).toContain("Nom du carnet");
    expect(html).toContain("Créer le carnet");
    expect(html).toContain("Annuler");
  });

  it("mode renommage : titre adapté", () => {
    const html = renderToStaticMarkup(
      createElement(AccountCarnetFormModal, {
        mode: {
          kind: "rename",
          group: summary({ id: GROUP_A, name: "Week-end Loire" }),
        },
        onClose: () => undefined,
      }),
    );
    expect(html).toContain("Renommer ce carnet.");
    expect(html).toContain("Week-end Loire");
    expect(html).toContain("Enregistrer");
  });
});

describe("AccountAddToGroupModal", () => {
  it("checkboxes multi-carnets + Valider", () => {
    const html = renderToStaticMarkup(
      createElement(AccountAddToGroupModal, {
        eventIds: ["e1"],
        heading: "Concert jazz",
        groups: [summary({ id: GROUP_A, name: "Week-end Loire" })],
        memberships: [
          membership({
            eventId: "e1",
            groupId: GROUP_A,
            groupName: "Week-end Loire",
          }),
        ],
        onClose: () => undefined,
      }),
    );

    expect(html).toContain("Ranger dans des carnets");
    expect(html).toContain("Concert jazz");
    expect(html).toContain("1 favori");
    expect(html).toContain("Week-end Loire");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
    expect(html).toContain("Valider");
    expect(html).toContain("Créer un carnet");
  });

  it("bulk : heading N favoris, état vide", () => {
    const html = renderToStaticMarkup(
      createElement(AccountAddToGroupModal, {
        eventIds: ["e1", "e2", "e3"],
        heading: "3 favoris",
        groups: [],
        memberships: [],
        onClose: () => undefined,
      }),
    );

    expect(html).toContain("3 favoris");
    expect(html).toContain("Aucun carnet pour l’instant");
    expect(html).toContain("Créer un carnet");
  });
});

describe("AccountSignedIn — Mes carnets", () => {
  it("intro + couvertures + favoris sans barre de filtres", () => {
    const html = renderToStaticMarkup(
      createElement(AccountSignedIn, {
        user: { name: "A", email: "a@exemple.fr" },
        initialFavorites: [
          eventItem({ id: "e1", title: "Concert" }),
          eventItem({ id: "e2", title: "Expo" }),
        ],
        initialGroups: [
          summary({ id: GROUP_A, name: "Week-end Loire", eventCount: 1 }),
        ],
        initialMemberships: [
          membership({
            eventId: "e1",
            groupId: GROUP_A,
            groupName: "Week-end Loire",
          }),
        ],
      }),
    );

    expect(html).toContain("Mes carnets.");
    expect(html).toContain("Votre collection personnelle");
    expect(html).toContain("Mes favoris");
    expect(html).toContain("Week-end Loire");
    expect(html).toContain("Sélectionner");
    expect(html).toContain("Plus d’actions");
    expect(html).not.toContain("Vos détours");
    expect(html).not.toContain("La bibliothèque");
    expect(html).not.toContain("Sans carnet");
    expect(html).not.toContain('aria-label="Filtrer par carnet"');
    expect(html).toContain("Tous vos événements sauvegardés");
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
    expect(html).toContain("Mes carnets.");
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

describe("group-selection (vue détail groupe)", () => {
  it("sélection multiple + tout sélectionner + barre bulk", () => {
    let selected = new Set<string>();
    selected = nextSelectedIds(selected, "e1");
    selected = nextSelectedIds(selected, "e2");
    expect(selected.size).toBe(2);
    expect(selectAllToggleLabel(selected.size, 3)).toBe("Tout sélectionner");
    selected = selectAllIds(["e1", "e2", "e3"]);
    expect(selectAllToggleLabel(selected.size, 3)).toBe("Tout désélectionner");
    expect(shouldShowBulkBar(true, selected.size)).toBe(true);
    expect(shouldShowBulkBar(true, 0)).toBe(false);
  });
});
