"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@repo/ui/components/input-group";
import { Spinner } from "@repo/ui/components/spinner";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { FilterSelect } from "@/components/filter-select";

export const anyValue = "all";
export const overdueValue = "1";

type Filters = {
  type: string;
  q: string;
  kecamatan: string;
  status: string;
  assignee: string;
  overdue: string;
};

type Option = { value: string; label: string };

const noFilters: Filters = {
  type: anyValue,
  q: "",
  kecamatan: anyValue,
  status: anyValue,
  assignee: anyValue,
  overdue: anyValue,
};

function toQuery(filters: Filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value.trim();
    if (trimmed && trimmed !== anyValue) {
      params.set(key, trimmed);
    }
  }
  return params.toString();
}

// Filters apply as they change and live in the URL, so a filtered list is a link someone can share.
export function BowlFilters({
  type,
  typeOptions,
  search,
  kecamatan,
  status,
  assignee,
  overdue,
  kecamatanOptions,
  statusOptions,
  assigneeOptions,
  overdueOptions,
  labels,
}: {
  type: string | null;
  typeOptions: Option[];
  search: string;
  kecamatan: string | null;
  status: string | null;
  assignee: string | null;
  overdue: boolean;
  kecamatanOptions: Option[];
  statusOptions: Option[];
  assigneeOptions: Option[];
  overdueOptions: Option[];
  labels: {
    type: string;
    search: string;
    searchPlaceholder: string;
    kecamatan: string;
    status: string;
    assignee: string;
    overdue: string;
    clear: string;
    loading: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>({
    type: type ?? anyValue,
    q: search,
    kecamatan: kecamatan ?? anyValue,
    status: status ?? anyValue,
    assignee: assignee ?? anyValue,
    overdue: overdue ? overdueValue : anyValue,
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function apply(next: Filters) {
    setFilters(next);
    clearTimeout(searchTimer.current);
    const query = toQuery(next);
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function changeSearch(q: string) {
    const next = { ...filters, q };
    setFilters(next);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => apply(next), 300);
  }

  const isFiltered =
    filters.q.trim() !== "" ||
    filters.kecamatan !== anyValue ||
    filters.status !== anyValue ||
    filters.assignee !== anyValue ||
    filters.overdue !== anyValue;

  return (
    <search className="flex flex-wrap items-center gap-3">
      <FilterSelect
        id="bowl-type"
        label={labels.type}
        options={typeOptions}
        value={filters.type}
        onChange={(value) => apply({ ...filters, type: value, kecamatan: anyValue })}
      />
      <InputGroup className="w-full sm:w-72">
        <InputGroupAddon>
          <HugeiconsIcon icon={Search01Icon} />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label={labels.search}
          maxLength={100}
          value={filters.q}
          onChange={(event) => changeSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              apply(filters);
            }
          }}
          placeholder={labels.searchPlaceholder}
        />
      </InputGroup>
      <FilterSelect
        id="bowl-kecamatan"
        label={labels.kecamatan}
        options={kecamatanOptions}
        value={filters.kecamatan}
        onChange={(value) => apply({ ...filters, kecamatan: value })}
      />
      <FilterSelect
        id="bowl-status"
        label={labels.status}
        options={statusOptions}
        value={filters.status}
        onChange={(value) => apply({ ...filters, status: value })}
      />
      <FilterSelect
        id="bowl-assignee"
        label={labels.assignee}
        options={assigneeOptions}
        value={filters.assignee}
        onChange={(value) => apply({ ...filters, assignee: value })}
      />
      <FilterSelect
        id="bowl-overdue"
        label={labels.overdue}
        options={overdueOptions}
        value={filters.overdue}
        onChange={(value) => apply({ ...filters, overdue: value })}
      />
      {isFiltered ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => apply(noFilters)}>
          {labels.clear}
        </Button>
      ) : null}
      {isPending ? <Spinner aria-label={labels.loading} /> : null}
    </search>
  );
}
