"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ChangeEventHandler, type ReactNode } from "react";

const inputClassName =
  "h-11 w-full border border-line bg-foam py-0 pl-3.5 pr-11 text-sm text-ink placeholder:text-sand focus:outline-none focus:ring-1 focus:ring-mint disabled:opacity-60";

type AccountPasswordFieldProps = {
  id?: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  /** Contenu sous le champ (ex. lien « Mot de passe oublié ? »). */
  footer?: ReactNode;
};

export function AccountPasswordField({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
  required,
  minLength,
  disabled,
  footer,
}: AccountPasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-[12px] font-medium uppercase tracking-[0.1em] text-sand"
      >
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={inputClassName}
        />
        <button
          type="button"
          aria-label={
            visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-sand transition-colors hover:text-ink focus:outline-none focus-visible:ring-1 focus-visible:ring-mint disabled:opacity-60"
        >
          {visible ? (
            <EyeOff aria-hidden className="size-4" strokeWidth={1.75} />
          ) : (
            <Eye aria-hidden className="size-4" strokeWidth={1.75} />
          )}
        </button>
      </div>
      {footer}
    </div>
  );
}
