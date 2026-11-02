import type { ReactNode } from "react";

// Gráficas sin librería, dibujadas en el servidor. El color nunca va solo: cada parte tiene su
// nombre y su cifra en texto, y al pasar el cursor el navegador muestra el detalle
export type Slice = {
  key: string;
  label: string;
  value: number;
  // Valor CSS, como "var(--color-chart-p1)": con clases armadas Tailwind no las encontraría
  color: string;
};

const percent = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

function Swatch({ color }: { color: string }) {
  return <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} />;
}

export function Legend({ slices }: { slices: Slice[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-muted">
      {slices.map((slice) => (
        <li key={slice.key} className="flex items-center gap-1.5">
          <Swatch color={slice.color} />
          {slice.label}
        </li>
      ))}
    </ul>
  );
}

export type StackedRow = { key: string; label: ReactNode; detail?: ReactNode; segments: Slice[] };

// Barras horizontales partidas: el largo compara las filas y las partes muestran de qué está hecha cada una
export function StackedBars({ rows }: { rows: StackedRow[] }) {
  const sum = (row: StackedRow) => row.segments.reduce((total, segment) => total + segment.value, 0);
  const max = Math.max(1, ...rows.map(sum));

  return (
    <ul className="flex flex-col gap-5">
      {rows.map((row) => {
        const total = sum(row);
        return (
          <li key={row.key} className="text-caption">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 font-medium">{row.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{total}</span>
            </div>
            <div className="mt-1.5 flex h-3 gap-0.5" style={{ width: `${(total / max) * 100}%` }}>
              {row.segments
                .filter((segment) => segment.value > 0)
                .map((segment) => (
                  <span
                    key={segment.key}
                    title={`${segment.label}: ${segment.value}`}
                    className="h-full transition-opacity duration-150 last:rounded-r-sm hover:opacity-75"
                    style={{ flexGrow: segment.value, background: segment.color }}
                  />
                ))}
            </div>
            {row.detail && <div className="mt-1.5 text-muted">{row.detail}</div>}
          </li>
        );
      })}
    </ul>
  );
}

// Dona para ver de un vistazo cómo se reparte el total. Con pocas partes; para comparar cifras parecidas, barras
export function Donut({ slices, total, caption }: { slices: Slice[]; total: number; caption: string }) {
  // Circunferencia normalizada a 100 para que cada parte sea su porcentaje. El hueco separa partes vecinas
  const gap = slices.filter((slice) => slice.value > 0).length > 1 ? 1 : 0;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={`${total} ${caption}`}>
          <circle cx="60" cy="60" r="48" fill="none" strokeWidth="16" className="stroke-line" />
          {total > 0 &&
            slices.map((slice) => {
              const length = (slice.value / total) * 100;
              const start = offset;
              offset += length;
              if (slice.value === 0) return null;
              return (
                <circle
                  key={slice.key}
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  strokeWidth="16"
                  pathLength={100}
                  strokeDasharray={`${Math.max(length - gap, 0.5)} ${100 - Math.max(length - gap, 0.5)}`}
                  strokeDashoffset={-start}
                  stroke={slice.color}
                  className="transition-opacity duration-150 hover:opacity-75"
                >
                  <title>{`${slice.label}: ${slice.value} (${percent(slice.value, total)}%)`}</title>
                </circle>
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-title leading-none font-semibold">{total}</span>
          <span className="mt-1 text-label text-muted">{caption}</span>
        </div>
      </div>
      <ul className="flex min-w-40 flex-1 flex-col gap-2 text-caption">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2">
            <Swatch color={slice.color} />
            <span className="flex-1">{slice.label}</span>
            <span className="font-semibold tabular-nums">{slice.value}</span>
            <span className="w-10 text-right text-muted tabular-nums">{percent(slice.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Columnas para una escala con orden, como la prioridad. La cifra va sobre cada columna
// y el nombre debajo, en la línea base
export function Columns({ slices, names }: { slices: Slice[]; names: Record<string, string> }) {
  const max = Math.max(1, ...slices.map((slice) => slice.value));

  return (
    <>
      <div className="flex h-40 items-end gap-2 border-b border-line">
        {slices.map((slice) => (
          <div key={slice.key} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="text-caption font-semibold tabular-nums">{slice.value}</span>
            <span
              title={`${slice.label} ${names[slice.key]}: ${slice.value}`}
              className="mt-1 w-6 rounded-t-sm transition-opacity duration-150 hover:opacity-75"
              style={{ height: `${(slice.value / max) * 80}%`, background: slice.color }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 text-center">
        {slices.map((slice) => (
          <div key={slice.key} className="flex-1">
            <p className="text-caption font-semibold">{slice.label}</p>
            <p className="text-label text-muted">{names[slice.key]}</p>
          </div>
        ))}
      </div>
    </>
  );
}

// Una sola barra al 100% para dos o tres partes, donde una dona sería demasiado
export function SplitBar({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-sm bg-line">
        {slices
          .filter((slice) => slice.value > 0)
          .map((slice) => (
            <span
              key={slice.key}
              title={`${slice.label}: ${slice.value}`}
              className="h-full"
              style={{ flexGrow: slice.value, background: slice.color }}
            />
          ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-caption">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2">
            <Swatch color={slice.color} />
            <span className="flex-1">{slice.label}</span>
            <span className="font-semibold tabular-nums">{slice.value}</span>
            <span className="w-10 text-right text-muted tabular-nums">{percent(slice.value, total)}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}
