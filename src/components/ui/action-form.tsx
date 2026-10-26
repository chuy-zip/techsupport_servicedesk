"use client";

import { useActionState, type ReactNode } from "react";

type ActionState = { error?: string } | undefined;

// Formulario para una acción de servidor que devuelve un error o nada.
// Mientras se envía, deshabilita sus controles para evitar dobles envíos
export function ActionForm({
  action,
  children,
  className = "",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && (
        <p role="alert" className="mt-2 text-caption text-p1">
          {state.error}
        </p>
      )}
    </form>
  );
}
