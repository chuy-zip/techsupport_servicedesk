"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-field";
import type { ActionState } from "./actions";

// Acción que exige una nota, como una descripción obligatoria antes de unir un PR.
// El botón confirma solo con texto; el servidor también rechaza una nota vacía
export function NoteAction({
  action,
  fields,
  label,
  prompt,
  internal,
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  prompt: string;
  internal: boolean;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="self-start">
        {label}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <TextArea
        label={prompt}
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        hint={internal ? "Nota interna: solo la ve el equipo." : "La ve también el cliente."}
        maxLength={2000}
        error={state?.error}
        autoFocus
        className="[&_textarea]:min-h-20"
      />
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" disabled={pending || note.trim() === ""}>
          {pending ? "Guardando…" : label}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)} className="border-transparent">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
