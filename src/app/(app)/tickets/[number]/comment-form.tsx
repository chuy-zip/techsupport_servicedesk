"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-field";
import { addComment, type CommentState } from "./actions";

export function CommentForm({ ticketId, canWriteInternal }: { ticketId: string; canWriteInternal: boolean }) {
  const [state, action, pending] = useActionState(addComment, undefined);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);

  // Después de enviar, el campo se vacía; si hubo error, el texto se conserva
  const [lastState, setLastState] = useState<CommentState>(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.sent) {
      setBody("");
      setInternal(false);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <TextArea
        label="Agregar un comentario"
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        error={state?.error}
        className="[&_textarea]:min-h-24"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canWriteInternal ? (
          <label className="flex items-center gap-2 text-caption">
            <input
              type="checkbox"
              name="internal"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
              className="accent-olive"
              aria-describedby="internal-hint"
            />
            Es nota interna
            <span id="internal-hint" className="sr-only">
              El cliente no ve las notas internas
            </span>
          </label>
        ) : (
          <span />
        )}
        <Button type="submit" variant="secondary" disabled={pending || body.trim() === ""}>
          {pending ? "Enviando…" : "Agregar comentario"}
        </Button>
      </div>
    </form>
  );
}
