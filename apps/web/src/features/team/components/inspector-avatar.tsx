"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@repo/ui/components/hover-card";

import type { TeamMember } from "@/features/team/team-queries";
import { dicebearAvatarUrl } from "@/lib/avatar";
import { fill, formatDateShort, type Dictionary, type Locale } from "@/lib/i18n";

export type InspectorAvatarLabels = Pick<
  Dictionary["team"],
  "openVisits" | "nextVisit" | "note" | "overdueCount" | "statuses"
>;

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function InspectorFace({
  name,
  size = "default",
  className,
}: {
  name: string;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarImage src={dicebearAvatarUrl(name)} alt="" />
      <AvatarFallback>{initialsFromName(name)}</AvatarFallback>
    </Avatar>
  );
}

export function InspectorAvatar({
  name,
  member,
  locale,
  labels,
  size = "default",
}: {
  name: string;
  member?: Pick<
    TeamMember,
    "active" | "note" | "openVisits" | "overdueVisits" | "nextVisitDate"
  > | null;
  locale: Locale;
  labels: InspectorAvatarLabels;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            type="button"
            className="pressable rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            aria-label={name}
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <InspectorFace name={name} size={size} />
      </HoverCardTrigger>
      <HoverCardContent align="start" side="bottom" className="w-64">
        <div className="flex gap-3">
          <InspectorFace name={name} size="lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="space-y-1">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              {member ? (
                <Badge variant={member.active ? "brand" : "secondary"}>
                  {member.active ? labels.statuses.active : labels.statuses.archived}
                </Badge>
              ) : null}
            </div>
            {member ? (
              <dl className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-baseline justify-between gap-3">
                  <dt>{labels.openVisits}</dt>
                  <dd className="inline-flex items-center gap-1.5 tabular-nums text-foreground">
                    <span>{member.openVisits}</span>
                    {member.overdueVisits > 0 ? (
                      <Badge variant="destructive">
                        {fill(labels.overdueCount, { count: member.overdueVisits })}
                      </Badge>
                    ) : null}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt>{labels.nextVisit}</dt>
                  <dd className="font-mono text-foreground">
                    {member.nextVisitDate
                      ? formatDateShort(locale, member.nextVisitDate)
                      : "–"}
                  </dd>
                </div>
                {member.note ? (
                  <div className="space-y-0.5 pt-0.5">
                    <dt>{labels.note}</dt>
                    <dd className="text-foreground">{member.note}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
