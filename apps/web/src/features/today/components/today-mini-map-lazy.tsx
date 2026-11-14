"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import dynamic from "next/dynamic";

export const TodayMiniMapLazy = dynamic(
  () => import("@/features/today/components/today-mini-map").then((module) => module.TodayMiniMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-56 w-full" />,
  },
);
