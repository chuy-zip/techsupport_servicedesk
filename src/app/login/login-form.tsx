"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-5">
      <TextField
        label="Correo"
        name="email"
        type="email"
        autoComplete="username"
        required
        defaultValue={state?.email}
      />
      <TextField label="Contraseña" name="password" type="password" autoComplete="current-password" required />
      {state?.error && (
        <p role="alert" className="text-caption text-p1">
          {state.error} Revisa los datos e intenta de nuevo.
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
