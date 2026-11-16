import { cn } from "@/lib/cn";

type EventPracticalInfoProps = {
  priceLabel: string | null;
  availabilityLabel: string | null;
  conditions: string | null;
  className?: string;
};

/** Informations explicites, partagées par la fiche publique et la modale. */
export function EventPracticalInfo({
  priceLabel,
  availabilityLabel,
  conditions,
  className = "mt-5 pt-4",
}: EventPracticalInfoProps) {
  if (!priceLabel && !availabilityLabel && !conditions) return null;

  return (
    <div
      data-testid="event-practical"
      className={cn("space-y-2 border-t border-line/70 text-sm", className)}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sand">
        Informations pratiques
      </p>
      {priceLabel ? (
        <p data-testid="event-price" className="font-medium text-ink">
          {priceLabel}
        </p>
      ) : null}
      {availabilityLabel ? (
        <p
          data-testid="event-availability"
          className="font-semibold uppercase tracking-[0.06em] text-coral"
        >
          {availabilityLabel}
        </p>
      ) : null}
      {conditions ? (
        <p data-testid="event-conditions" className="whitespace-pre-wrap leading-6 text-ink">
          {conditions}
        </p>
      ) : null}
    </div>
  );
}
