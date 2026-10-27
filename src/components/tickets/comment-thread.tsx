import type { CommentKind, Role } from "@/generated/prisma/client";
import { commentKindNames, formatDate, roleNames } from "@/lib/tickets/labels";

type ThreadComment = {
  id: string;
  body: string;
  internal: boolean;
  kind: CommentKind;
  createdAt: Date;
  author: { id: string; name: string; role: Role };
};

const kindClasses: Record<CommentKind, string> = {
  NOTE: "",
  RESOLUTION: "bg-lime text-ink",
  REOPENING: "bg-p2-bg text-p2",
  CLOSURE: "bg-line text-muted",
  ESCALATION: "bg-line text-muted",
  APPROVAL_REQUEST: "bg-p2-bg text-p2",
};

const chip = "rounded-full px-2 py-0.5 text-label font-semibold";

// Hilo tipo chat: los mensajes propios a la derecha, para reconocerlos de un vistazo
export function CommentThread({
  comments,
  viewer,
}: {
  comments: ThreadComment[];
  viewer: { id: string; role: Role };
}) {
  const viewerIsClient = viewer.role === "CLIENT";

  return (
    <ol className="flex flex-col gap-3">
      {comments.map((comment) => {
        const mine = comment.author.id === viewer.id;
        const kindName = commentKindNames[comment.kind];
        // Al cliente le basta saber que respondió el equipo; el rol interno es del personal
        const role =
          viewerIsClient && comment.author.role !== "CLIENT" ? "Equipo de soporte" : roleNames[comment.author.role];
        const tone = comment.internal
          ? "border-p2/30 bg-p2-bg"
          : mine
            ? "border-olive/25 bg-lime/25"
            : "border-line bg-surface";

        return (
          <li
            key={comment.id}
            className={`max-w-[88%] rounded-control border px-4 py-3 ${tone} ${mine ? "self-end" : "self-start"}`}
          >
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-caption">
              <span className="font-semibold">{mine ? "Tú" : comment.author.name}</span>
              {!mine && <span className="text-muted">{role}</span>}
              <span className="text-muted tabular-nums">{formatDate(comment.createdAt)}</span>
              {kindName && <span className={`${chip} ${kindClasses[comment.kind]}`}>{kindName}</span>}
              {comment.internal && <span className={`${chip} bg-surface text-p2`}>Nota interna</span>}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
