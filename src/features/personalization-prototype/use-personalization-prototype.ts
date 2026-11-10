"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearPersonalizationState,
  readPersonalizationState,
  writePersonalizationState,
} from "./storage";
import {
  DEFAULT_PERSONALIZATION_STATE,
  EMPTY_PREFERENCES,
  type OnboardingStatus,
  type PersonalizationPreferences,
  type PersonalizationPrototypeState,
} from "./types";

export function usePersonalizationPrototype(authUserId: string | null) {
  const [state, setState] = useState<PersonalizationPrototypeState>(
    DEFAULT_PERSONALIZATION_STATE,
  );
  const [hydrated, setHydrated] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    setState(readPersonalizationState());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: PersonalizationPrototypeState) => {
    setState(next);
    writePersonalizationState(next);
  }, []);

  const isPersonaActive = Boolean(authUserId) || state.prototypeSignedIn;

  useEffect(() => {
    if (!hydrated || !isPersonaActive) return;
    if (state.postAuthPromptSeen) return;
    if (
      state.onboardingStatus === "completed" ||
      state.onboardingStatus === "skipped"
    ) {
      return;
    }
    setGateOpen(true);
  }, [
    hydrated,
    isPersonaActive,
    state.onboardingStatus,
    state.postAuthPromptSeen,
  ]);

  const enablePrototypeSession = useCallback(() => {
    persist({
      ...state,
      prototypeSignedIn: true,
      postAuthPromptSeen: false,
    });
  }, [persist, state]);

  const disablePrototypeSession = useCallback(() => {
    persist({
      ...state,
      prototypeSignedIn: false,
    });
    setGateOpen(false);
    setOnboardingOpen(false);
  }, [persist, state]);

  const markPromptSeen = useCallback(() => {
    persist({ ...state, postAuthPromptSeen: true });
  }, [persist, state]);

  const deferOnboarding = useCallback(() => {
    persist({
      ...state,
      onboardingStatus: "deferred",
      postAuthPromptSeen: true,
    });
    setGateOpen(false);
  }, [persist, state]);

  const skipOnboarding = useCallback(() => {
    persist({
      ...state,
      onboardingStatus: "skipped",
      postAuthPromptSeen: true,
      preferences: EMPTY_PREFERENCES,
      newsletterPreviewChecked: false,
    });
    setGateOpen(false);
    setOnboardingOpen(false);
  }, [persist, state]);

  const startOnboarding = useCallback(() => {
    markPromptSeen();
    setGateOpen(false);
    setOnboardingOpen(true);
  }, [markPromptSeen]);

  const openEditor = useCallback(() => {
    setOnboardingOpen(true);
  }, []);

  const closeOnboarding = useCallback(() => {
    setOnboardingOpen(false);
  }, []);

  const completeOnboarding = useCallback(
    (
      preferences: PersonalizationPreferences,
      newsletterPreviewChecked: boolean,
    ) => {
      persist({
        ...state,
        onboardingStatus: "completed" satisfies OnboardingStatus,
        preferences,
        newsletterPreviewChecked,
        postAuthPromptSeen: true,
      });
      setOnboardingOpen(false);
      setGateOpen(false);
    },
    [persist, state],
  );

  const resetPrototype = useCallback(() => {
    clearPersonalizationState();
    setState(DEFAULT_PERSONALIZATION_STATE);
    setGateOpen(false);
    setOnboardingOpen(false);
  }, []);

  return {
    hydrated,
    state,
    isPersonaActive,
    showForYou: isPersonaActive && state.onboardingStatus === "completed",
    showDeferredCue:
      isPersonaActive &&
      (state.onboardingStatus === "deferred" ||
        state.onboardingStatus === "skipped"),
    gateOpen,
    onboardingOpen,
    enablePrototypeSession,
    disablePrototypeSession,
    deferOnboarding,
    skipOnboarding,
    startOnboarding,
    openEditor,
    closeOnboarding,
    completeOnboarding,
    resetPrototype,
    dismissGate: deferOnboarding,
  };
}
