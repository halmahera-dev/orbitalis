"use client";

import { Button } from "@repo/ui/components/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <div className="print:hidden">
      <Button size="sm" onClick={() => window.print()}>
        {label}
      </Button>
    </div>
  );
}
