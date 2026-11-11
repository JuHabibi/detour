"use client";

import { useId, useState } from "react";
import { AppModal } from "@/components/ui/AppModal";
import { cn } from "@/lib/cn";
import type {
  UserProfileAvailability,
  UserProfileBudget,
  UserProfileInterest,
  UserProfileWrite,
} from "@/domain/personalization/user-profile";
import {
  AVAILABILITY_OPTIONS,
  BUDGET_OPTIONS,
  INTEREST_OPTIONS,
} from "./options";

type PreferencesDraft = {
  interests: UserProfileInterest[];
  availabilities: UserProfileAvailability[];
  budget: UserProfileBudget;
};

type PersonalizationOnboardingProps = {
  initialPreferences: PreferencesDraft;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onDefer: () => void;
  onComplete: (write: UserProfileWrite) => void;
};

const STEPS = [
  { id: "interests", title: "Qu’est-ce qui vous attire ?" },
  { id: "availability", title: "Quand sortez-vous le plus souvent ?" },
  { id: "budget", title: "Quel budget vous convient ?" },
] as const;

export function PersonalizationOnboarding({
  initialPreferences,
  busy = false,
  error = null,
  onClose,
  onDefer,
  onComplete,
}: PersonalizationOnboardingProps) {
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<UserProfileInterest[]>(
    initialPreferences.interests,
  );
  const [availabilities, setAvailabilities] = useState<
    UserProfileAvailability[]
  >(initialPreferences.availabilities);
  const [budget, setBudget] = useState<UserProfileBudget>(
    initialPreferences.budget,
  );
  const progressId = useId();
  const current = STEPS[step]!;

  function toggleInterest(id: UserProfileInterest) {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleAvailability(id: UserProfileAvailability) {
    if (id === "flexible") {
      setAvailabilities((prev) =>
        prev.includes("flexible") ? [] : ["flexible"],
      );
      return;
    }
    setAvailabilities((prev) => {
      const withoutFlexible = prev.filter((item) => item !== "flexible");
      return withoutFlexible.includes(id)
        ? withoutFlexible.filter((item) => item !== id)
        : [...withoutFlexible, id];
    });
  }

  function goNext() {
    if (busy) return;
    if (step < STEPS.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    onComplete({
      interests,
      availabilities: availabilities.length > 0 ? availabilities : ["flexible"],
      budget,
      onboardingStatus: "completed",
    });
  }

  const canContinue =
    !busy &&
    (step === 0
      ? interests.length > 0
      : step === 1
        ? availabilities.length > 0
        : true);

  return (
    <AppModal
      eyebrow={`Étape ${step + 1} sur ${STEPS.length}`}
      title={current.title}
      description="Vos choix sont enregistrés sur votre compte Détour."
      onClose={busy ? () => undefined : onClose}
      size="lg"
      className="max-h-[min(92vh,40rem)]"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onDefer}
            disabled={busy}
            className="min-h-11 text-left text-[12px] font-medium uppercase tracking-[0.1em] text-sand underline decoration-line underline-offset-4 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Passer pour l’instant
          </button>
          <div className="flex flex-wrap gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((value) => value - 1)}
                disabled={busy}
                className="inline-flex min-h-11 items-center border border-ink/25 bg-foam px-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Retour
              </button>
            ) : null}
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue}
              className="inline-flex min-h-11 items-center bg-mint px-5 text-[12px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-foam disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {busy
                ? "Enregistrement…"
                : step === STEPS.length - 1
                  ? "Enregistrer"
                  : "Continuer"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 overflow-y-auto pr-1">
        <div
          id={progressId}
          className="flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label="Progression de l’onboarding"
        >
          {STEPS.map((item, index) => (
            <span
              key={item.id}
              className={cn("h-1 flex-1", index <= step ? "bg-ink" : "bg-line")}
            />
          ))}
        </div>

        {error ? (
          <p className="text-sm text-coral" role="alert">
            {error}
          </p>
        ) : null}

        {step === 0 ? (
          <fieldset className="space-y-3">
            <legend className="sr-only">Centres d’intérêt</legend>
            <p className="text-sm leading-6 text-cream-dim">
              Choisissez au moins une piste. Vous pourrez affiner plus tard.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((option) => {
                const active = interests.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleInterest(option.id)}
                    className={cn(
                      "min-h-11 px-3 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      active
                        ? "bg-ink text-foam"
                        : "bg-paper text-cream-dim hover:bg-mint-soft hover:text-ink",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="space-y-3">
            <legend className="sr-only">Disponibilités</legend>
            <p className="text-sm leading-6 text-cream-dim">
              Plusieurs créneaux possibles. « Je m’adapte » remplace les autres.
            </p>
            <div className="grid gap-2">
              {AVAILABILITY_OPTIONS.map((option) => {
                const active = availabilities.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleAvailability(option.id)}
                    className={cn(
                      "flex min-h-14 flex-col items-start gap-0.5 border px-3.5 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      active
                        ? "border-ink bg-ink text-foam"
                        : "border-line bg-paper text-ink hover:border-ink/40",
                    )}
                  >
                    <span className="text-[13px] font-medium">
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "text-[12px]",
                        active ? "text-foam/75" : "text-cream-dim",
                      )}
                    >
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset className="space-y-4">
            <legend className="sr-only">Budget</legend>
            <p className="text-sm leading-6 text-cream-dim">
              Un seul choix. Cela affinera la sélection « Pour vous », sans
              cacher le Radar.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUDGET_OPTIONS.map((option) => {
                const active = budget === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setBudget(option.id)}
                    className={cn(
                      "flex min-h-14 flex-col items-start gap-0.5 border px-3.5 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      active
                        ? "border-ink bg-ink text-foam"
                        : "border-line bg-paper text-ink hover:border-ink/40",
                    )}
                  >
                    <span className="text-[13px] font-medium">
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "text-[12px]",
                        active ? "text-foam/75" : "text-cream-dim",
                      )}
                    >
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}
      </div>
    </AppModal>
  );
}
