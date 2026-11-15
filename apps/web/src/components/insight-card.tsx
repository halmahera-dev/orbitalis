import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

import { fill } from "@/lib/i18n";

export type InsightSentence = {
  template: string;
  values?: Record<string, string | number>;
};

const emphasisMark = "**";

function Sentence({ template, values = {} }: InsightSentence) {
  return fill(template, values)
    .split(emphasisMark)
    .map((part, index) =>
      index % 2 === 1 ? (
        <strong key={`${index}-${part}`} className="font-semibold text-foreground">
          {part}
        </strong>
      ) : (
        part
      ),
    );
}

export function InsightCard({
  title,
  sentences,
  action,
  className,
}: {
  title: string;
  sentences: InsightSentence[];
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("insight-card flex min-w-0 flex-col gap-3 p-4", className)}
    >
      <div className="flex min-h-7 items-center gap-2 text-sm text-muted-foreground">
        <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} className="size-4" />
        <h2 className="flex-1">{title}</h2>
        {action}
      </div>
      <p className="type-title text-xl text-muted-foreground">
        {sentences.map((sentence, index) => (
          <span key={sentence.template}>
            {index > 0 ? " " : null}
            <Sentence {...sentence} />
          </span>
        ))}
      </p>
    </section>
  );
}
