"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  acquireBodyScrollLock,
  isTopStackedDialogLayer,
  onStackedDialogEscape,
  pushStackedDialogLayer,
  releaseBodyScrollLock,
  restoreDialogFocusTriggerFirst,
  restoreDialogReturnFocus,
} from "@/lib/stacked-dialog";

export type StackedDialogFocusRestore = "trigger-first" | "selectors-first";

type UseStackedDialogLifecycleParams = {
  onClose: () => void;
  /** Élément focalisé à l’ouverture (ex. bouton fermer). */
  initialFocusRef: RefObject<HTMLElement | null>;
  returnFocusTo?: HTMLElement | null;
  /**
   * Sélecteurs vivants / de repli pour la restauration du focus.
   * Interprétés selon `focusRestore`.
   */
  focusSelectors?: string | readonly string[] | null;
  /**
   * `trigger-first` (défaut) : déclencheur puis sélecteurs (AppModal).
   * `selectors-first` : sélecteurs vivants puis déclencheur (fiche événement).
   */
  focusRestore?: StackedDialogFocusRestore;
};

/**
 * Cycle de vie partagé des surfaces empilables (scroll, Échap, focus).
 * Monte une seule fois : les callbacks / cibles de focus restent à jour via refs.
 */
export function useStackedDialogLifecycle({
  onClose,
  initialFocusRef,
  returnFocusTo,
  focusSelectors,
  focusRestore = "trigger-first",
}: UseStackedDialogLifecycleParams): void {
  const onCloseRef = useRef(onClose);
  const returnFocusToRef = useRef(returnFocusTo);
  const focusSelectorsRef = useRef(focusSelectors);
  const focusRestoreRef = useRef(focusRestore);

  useEffect(() => {
    onCloseRef.current = onClose;
    returnFocusToRef.current = returnFocusTo;
    focusSelectorsRef.current = focusSelectors;
    focusRestoreRef.current = focusRestore;
  }, [onClose, returnFocusTo, focusSelectors, focusRestore]);

  useEffect(() => {
    acquireBodyScrollLock();
    const layer = pushStackedDialogLayer(() => onCloseRef.current());
    initialFocusRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (!isTopStackedDialogLayer(layer.id)) return;
      onStackedDialogEscape(e, () => onCloseRef.current());
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      layer.pop();
      releaseBodyScrollLock();

      if (focusRestoreRef.current === "selectors-first") {
        restoreDialogReturnFocus(
          returnFocusToRef.current,
          focusSelectorsRef.current,
        );
      } else {
        restoreDialogFocusTriggerFirst(
          returnFocusToRef.current,
          focusSelectorsRef.current,
        );
      }
    };
    // Montage seul : ne pas relancer scroll / focus / listeners sur re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialFocusRef stable
  }, []);
}
