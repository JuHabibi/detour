"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, MapPin, Search, Ticket } from "lucide-react";
import { categories } from "@/config/event-categories";
import type { CategoryId } from "@/data/types";
import { V1_COMMUNES, type V1Commune } from "@/domain/geo/v1-communes";
import type { WhenFilter } from "@/domain/time/when-filter";
import { EXPLORER_URL_DEFAULTS } from "@/features/explorer/explorer-url-state";
import { explorerPeriodTriggerLabel } from "@/features/explorer/explorer-period-copy";
import { ExplorerWhenPanel } from "@/features/explorer/components/ExplorerWhenPanel";
import { EVENT_META_ICON_STROKE } from "@/components/event/event-lucide-icons";
import { useStackedDialogLifecycle } from "@/lib/use-stacked-dialog-lifecycle";
import { cn } from "@/lib/cn";

/** Sauge foncée — lisible sur foam, alignée palette mint/sauge. */
const ICON_SAGE = "text-[#5a7564]";
const ICON_TERRACOTTA = "text-terracotta";

type PanelId = "when" | "where" | "what";

type ExplorerFilterBarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  when: WhenFilter;
  from: string | null;
  to: string | null;
  onPresetChange: (when: Exclude<WhenFilter, "range">) => void;
  onRangeApply: (from: string, to: string) => void;
  city: V1Commune | null;
  onCityChange: (value: V1Commune | null) => void;
  category: CategoryId;
  onCategoryChange: (value: CategoryId) => void;
};

const CITY_OPTIONS: { id: string; label: string }[] = [
  { id: "", label: "Toutes les villes" },
  ...V1_COMMUNES.map((commune) => ({ id: commune, label: commune })),
];

const PANEL_GAP = 8;
const VIEWPORT_PAD = 8;

function useIsCompactViewport() {
  const [compact, setCompact] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return compact;
}

/** Largeurs adaptées au contenu (indépendantes de la largeur du déclencheur). */
function preferredPanelWidth(panel: PanelId): number {
  const max = Math.max(240, window.innerWidth - VIEWPORT_PAD * 2);
  if (panel === "when") return Math.min(400, max);
  if (panel === "where") return Math.min(280, max);
  return Math.min(320, max);
}

function FilterTrigger({
  label,
  value,
  open,
  active,
  controlsId,
  onClick,
  triggerRef,
  icon,
  iconClassName,
}: {
  label: string;
  value: string;
  open: boolean;
  /** Filtre hors défaut (sélection réelle). */
  active: boolean;
  controlsId: string;
  onClick: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  icon: ReactNode;
  /** Teinte icône au repos (sauge / terracotta). */
  iconClassName: string;
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-expanded={open}
      aria-controls={controlsId}
      aria-haspopup="dialog"
      aria-pressed={active}
      title={`${label} ${value}`}
      onClick={onClick}
      className={cn(
        "flex min-h-11 min-w-0 flex-1 basis-0 flex-col justify-center gap-0.5 border px-2.5 py-1.5 text-left transition-colors sm:min-h-12 sm:px-3",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mint",
        open
          ? "border-ink bg-ink text-foam"
          : active
            ? "border-sauge bg-mint/15 text-ink hover:border-mint/50"
            : "border-line bg-foam text-ink hover:border-ink/40",
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em]",
          open ? "text-foam/70" : "text-sand",
        )}
      >
        <span
          aria-hidden
          className={cn("shrink-0", open ? "text-foam/80" : iconClassName)}
        >
          {icon}
        </span>
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate text-[13px] font-medium leading-tight">
          {value}
        </span>
        <span
          aria-hidden
          className={cn(
            "shrink-0 text-[10px]",
            open ? "text-foam/70" : "text-sand",
          )}
        >
          {open ? "▴" : "▾"}
        </span>
      </span>
    </button>
  );
}

function CityPanel({
  city,
  onCityChange,
  initialFocusRef,
}: {
  city: V1Commune | null;
  onCityChange: (value: V1Commune | null) => void;
  initialFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div role="listbox" aria-label="Ville" className="max-h-72 overflow-y-auto">
      {CITY_OPTIONS.map((option, index) => {
        const active = (city ?? "") === option.id;
        return (
          <button
            key={option.id || "all"}
            ref={index === 0 ? initialFocusRef : undefined}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() =>
              onCityChange(option.id === "" ? null : (option.id as V1Commune))
            }
            className={cn(
              "flex min-h-10 w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink",
              active ? "bg-ink text-foam" : "text-ink hover:bg-mint-soft",
            )}
          >
            <span className="truncate">{option.label}</span>
            {active ? <span aria-hidden>·</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function CategoryPanel({
  category,
  onCategoryChange,
  initialFocusRef,
}: {
  category: CategoryId;
  onCategoryChange: (value: CategoryId) => void;
  initialFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div
      role="listbox"
      aria-label="Catégorie"
      className="max-h-72 overflow-y-auto"
    >
      {categories.map((item, index) => {
        const active = item.id === category;
        return (
          <button
            key={item.id}
            ref={index === 0 ? initialFocusRef : undefined}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onCategoryChange(item.id)}
            className={cn(
              "flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ink",
              active ? "bg-ink text-foam" : "text-ink hover:bg-mint-soft",
            )}
          >
            <span className="min-w-0 truncate">{item.label}</span>
            {active ? <span aria-hidden>·</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function MobileFilterSheet({
  title,
  panelId,
  onClose,
  returnFocusTo,
  children,
}: {
  title: string;
  panelId: string;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
  children: (
    initialFocusRef: RefObject<HTMLButtonElement | null>,
  ) => ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelFocusRef = useRef<HTMLButtonElement>(null);

  useStackedDialogLifecycle({
    onClose,
    initialFocusRef: panelFocusRef,
    returnFocusTo,
  });

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Fermer le filtre"
        className="absolute inset-0 bg-ink/35"
        onClick={onClose}
      />
      <div
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[min(85vh,36rem)] overflow-y-auto border-t border-line bg-paper px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(17_17_17/16%)]"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
            {title}
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 items-center px-2 text-[12px] font-medium text-sand underline decoration-line underline-offset-4 hover:text-ink"
          >
            Fermer
          </button>
        </div>
        {children(panelFocusRef)}
      </div>
    </div>,
    document.body,
  );
}

/** Popover desktop : portal fixed, ancré au déclencheur, anti-clipping viewport. */
function DesktopFilterPopover({
  panelId,
  title,
  panel,
  triggerRef,
  panelRef,
  onClose,
  children,
}: {
  panelId: string;
  title: string;
  panel: PanelId;
  triggerRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = preferredPanelWidth(panel);

      // Ancrage au déclencheur : aligné à gauche, bascule à droite si dépasse.
      let left = rect.left;
      if (left + width > window.innerWidth - VIEWPORT_PAD) {
        left = rect.right - width;
      }
      if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
      if (left + width > window.innerWidth - VIEWPORT_PAD) {
        left = window.innerWidth - VIEWPORT_PAD - width;
      }

      // Toujours sous le déclencheur ; scroll interne si le contenu dépasse.
      const top = rect.bottom + PANEL_GAP;
      const maxHeight = Math.max(
        180,
        window.innerHeight - top - VIEWPORT_PAD,
      );

      setCoords({ top, left, width, maxHeight });
    }

    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [panel, triggerRef, panelRef]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, panelRef, triggerRef]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={title}
      style={
        coords
          ? {
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }
          : { position: "fixed", top: 0, left: 0, visibility: "hidden" }
      }
      className="z-[70] overflow-y-auto border border-line bg-paper p-3 shadow-[0_12px_40px_rgb(17_17_17/12%)]"
    >
      {children}
    </div>,
    document.body,
  );
}

export function ExplorerFilterBar({
  searchInput,
  onSearchInputChange,
  when,
  from,
  to,
  onPresetChange,
  onRangeApply,
  city,
  onCityChange,
  category,
  onCategoryChange,
}: ExplorerFilterBarProps) {
  const baseId = useId();
  const whenPanelId = `${baseId}-when`;
  const wherePanelId = `${baseId}-where`;
  const whatPanelId = `${baseId}-what`;
  const whenTriggerRef = useRef<HTMLButtonElement>(null);
  const whereTriggerRef = useRef<HTMLButtonElement>(null);
  const whatTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopPanelRef = useRef<HTMLDivElement>(null);
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);
  const compact = useIsCompactViewport();

  const whenLabel = explorerPeriodTriggerLabel(when, from, to);
  const cityLabel =
    CITY_OPTIONS.find((option) => option.id === (city ?? ""))?.label ??
    "Toutes les villes";
  const categoryLabel =
    categories.find((item) => item.id === category)?.label ?? "Tout";

  const whenActive = when !== EXPLORER_URL_DEFAULTS.when;
  const whereActive = city != null;
  const whatActive = category !== EXPLORER_URL_DEFAULTS.category;

  function togglePanel(panel: PanelId) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  function closePanel() {
    setOpenPanel(null);
  }

  const activePanelId =
    openPanel === "when"
      ? whenPanelId
      : openPanel === "where"
        ? wherePanelId
        : openPanel === "what"
          ? whatPanelId
          : undefined;

  const activeTriggerRef =
    openPanel === "when"
      ? whenTriggerRef
      : openPanel === "where"
        ? whereTriggerRef
        : openPanel === "what"
          ? whatTriggerRef
          : whenTriggerRef;

  const returnFocus = activeTriggerRef.current;

  function renderPanelBody(
    initialFocusRef?: RefObject<HTMLButtonElement | null>,
  ) {
    if (openPanel === "when") {
      return (
        <ExplorerWhenPanel
          when={when}
          from={from}
          to={to}
          initialFocusRef={initialFocusRef}
          onPresetChange={(value) => {
            onPresetChange(value);
            closePanel();
          }}
          onRangeApply={(nextFrom, nextTo) => {
            onRangeApply(nextFrom, nextTo);
            closePanel();
          }}
        />
      );
    }
    if (openPanel === "where") {
      return (
        <CityPanel
          city={city}
          initialFocusRef={initialFocusRef}
          onCityChange={(value) => {
            onCityChange(value);
            closePanel();
          }}
        />
      );
    }
    if (openPanel === "what") {
      return (
        <CategoryPanel
          category={category}
          initialFocusRef={initialFocusRef}
          onCategoryChange={(value) => {
            onCategoryChange(value);
            closePanel();
          }}
        />
      );
    }
    return null;
  }

  const panelTitle =
    openPanel === "when"
      ? "Quand ?"
      : openPanel === "where"
        ? "Où ?"
        : openPanel === "what"
          ? "Quoi ?"
          : "";

  return (
    <div className="relative flex flex-col gap-2 overflow-visible">
      <label className="relative block w-full min-w-0">
        <span className="sr-only">Recherche</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sand"
          strokeWidth={EVENT_META_ICON_STROKE}
        />
        <input
          type="search"
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="Rechercher un événement, un lieu..."
          className="h-11 w-full border border-line bg-foam py-0 pl-10 pr-3.5 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint"
        />
      </label>

      <div
        role="group"
        aria-label="Filtres d’exploration"
        className="flex w-full gap-2"
      >
        <FilterTrigger
          label="Quand ?"
          value={whenLabel}
          open={openPanel === "when"}
          active={whenActive}
          controlsId={whenPanelId}
          triggerRef={whenTriggerRef}
          onClick={() => togglePanel("when")}
          iconClassName={ICON_SAGE}
          icon={
            <Calendar
              className="size-3.5"
              strokeWidth={EVENT_META_ICON_STROKE}
            />
          }
        />
        <FilterTrigger
          label="Où ?"
          value={cityLabel}
          open={openPanel === "where"}
          active={whereActive}
          controlsId={wherePanelId}
          triggerRef={whereTriggerRef}
          onClick={() => togglePanel("where")}
          iconClassName={ICON_TERRACOTTA}
          icon={
            <MapPin
              className="size-3.5"
              strokeWidth={EVENT_META_ICON_STROKE}
            />
          }
        />
        <FilterTrigger
          label="Quoi ?"
          value={categoryLabel}
          open={openPanel === "what"}
          active={whatActive}
          controlsId={whatPanelId}
          triggerRef={whatTriggerRef}
          onClick={() => togglePanel("what")}
          iconClassName={ICON_SAGE}
          icon={
            <Ticket
              className="size-3.5"
              strokeWidth={EVENT_META_ICON_STROKE}
            />
          }
        />
      </div>

      {openPanel && !compact ? (
        <DesktopFilterPopover
          panelId={activePanelId!}
          title={panelTitle}
          panel={openPanel}
          triggerRef={activeTriggerRef}
          panelRef={desktopPanelRef}
          onClose={closePanel}
        >
          {renderPanelBody()}
        </DesktopFilterPopover>
      ) : null}

      {openPanel && compact ? (
        <MobileFilterSheet
          title={panelTitle}
          panelId={activePanelId!}
          onClose={closePanel}
          returnFocusTo={returnFocus}
        >
          {(initialFocusRef) => renderPanelBody(initialFocusRef)}
        </MobileFilterSheet>
      ) : null}
    </div>
  );
}
