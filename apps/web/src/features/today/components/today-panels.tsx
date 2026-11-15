import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

export function Card({
  id,
  title,
  note,
  action,
  className,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("flex min-w-0 flex-col rounded-4xl bg-card shadow-card", className)}
    >
      <div className="flex items-baseline justify-between gap-4 border-b px-4 py-3">
        <h2 id={id} className="text-sm font-medium">
          {title}
        </h2>
        {action ?? (note ? <p className="text-xs text-muted-foreground">{note}</p> : null)}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  detail,
  href,
  children,
}: {
  label: string;
  value: string;
  detail?: string | null;
  href?: string;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex flex-col gap-1 px-4">
        <h3 className="text-xs text-muted-foreground">{label}</h3>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-2xl font-medium tracking-tight tabular-nums">{value}</p>
          {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
      {children ?? <div className="h-3" />}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        className="flex min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-4xl bg-card pt-3 shadow-card transition-colors duration-160 ease-out hover:bg-surface-raised"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-4xl bg-card pt-3 shadow-card">
      {body}
    </div>
  );
}

function share(value: number, total: number) {
  return `${(value / Math.max(total, 1)) * 100}%`;
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-1.5 rounded-full bg-muted-foreground/15" aria-hidden="true">
      {value > 0 ? (
        <div
          className="h-full w-(--bar-width) rounded-full bg-chart-2"
          style={{ "--bar-width": share(value, max) } as React.CSSProperties}
        />
      ) : null}
    </div>
  );
}

export function CountList({
  rows,
  emptyMessage,
}: {
  rows: { key: string; label: string; count: number; detail?: string; href?: string }[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }
  const max = Math.max(...rows.map((row) => row.count));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const content = (
          <>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{row.label}</span>
              {row.detail ? (
                <span className="truncate text-xs text-muted-foreground">{row.detail}</span>
              ) : null}
            </span>
            <Bar value={row.count} max={max} />
            <span className="text-right tabular-nums">{row.count}</span>
          </>
        );
        return (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                prefetch={false}
                className="grid grid-cols-3 items-center gap-4 text-sm transition-colors duration-160 ease-out hover:text-brand-text"
              >
                {content}
              </Link>
            ) : (
              <div className="grid grid-cols-3 items-center gap-4 text-sm">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SplitRows({
  rows,
}: {
  rows: { label: string; value: number; color: string; href?: string }[];
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <>
      <div
        className="flex h-2 gap-px overflow-hidden rounded-full bg-muted-foreground/15"
        aria-hidden="true"
      >
        {rows.map((row) =>
          row.value > 0 ? (
            <div
              key={row.label}
              className={cn("w-(--bar-width)", row.color)}
              style={{ "--bar-width": share(row.value, total) } as React.CSSProperties}
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((row) => {
          const body = (
            <>
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className={cn("size-2 shrink-0 rounded-xs", row.color)} aria-hidden="true" />
                {row.label}
              </span>
              <span className="tabular-nums">{row.value}</span>
            </>
          );
          return (
            <li key={row.label}>
              {row.href ? (
                <Link
                  href={row.href}
                  prefetch={false}
                  className="flex items-center justify-between gap-4 transition-colors duration-160 ease-out hover:text-brand-text"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
