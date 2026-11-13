import { Badge } from "@repo/ui/components/badge";
import { SidebarTrigger } from "@repo/ui/components/sidebar";

export function PageHeader({
  title,
  tag,
  meta,
  actions,
}: {
  title: string;
  tag?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-3 border-b py-2 glass px-4 sm:px-6">
      <SidebarTrigger className="-ml-1" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-medium">{title}</h1>
          {tag ? (
            <Badge variant="outline" className="shrink-0">
              {tag}
            </Badge>
          ) : null}
        </div>
        {meta ? <div className="truncate text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
