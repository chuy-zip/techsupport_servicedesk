import { formatDuration } from "@/lib/tickets/labels";
import type { SlaProgress } from "@/lib/tickets/sla";

const barColor = {
  ok: "bg-olive",
  warning: "bg-p2",
  breached: "bg-p1",
};

// Elemento propio del sistema: cuánto del plazo comprometido ya se consumió. Estático, sin animación
export function SlaMeter({ label, progress }: { label: string; progress: SlaProgress }) {
  const percent = Math.min(progress.ratio, 1) * 100;
  const remaining = formatDuration(progress.remainingMinutes);
  const text =
    progress.state === "breached" ? `Vencido hace ${remaining}` : `Faltan ${remaining}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4 text-caption">
        <span className="text-muted">{label}</span>
        <span className={`font-semibold tabular-nums ${progress.state === "ok" ? "text-ink" : progress.state === "warning" ? "text-p2" : "text-p1"}`}>
          {text}
        </span>
      </div>
      <div
        className="h-[3px] overflow-hidden rounded-full bg-line"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div className={`h-full ${barColor[progress.state]}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
