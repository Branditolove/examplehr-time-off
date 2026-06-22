"use client";

import { useEffect, useRef, useState } from "react";
import { useBalance } from "@/hooks/useBalance";
import { useBalanceIntegrityStore } from "@/store/balanceIntegrityStore";
import { BalanceCard } from "./BalanceCard";

export function EmployeeBalanceRow({ employeeId, location, accentIndex = 0 }) {
  const query = useBalance(employeeId, location.id);
  const integrity = useBalanceIntegrityStore((state) => state.entries[`${employeeId}:${location.id}`]);

  const previousBalanceRef = useRef(undefined);
  const wasFetchingRef = useRef(query.isFetching);
  const [justRefreshed, setJustRefreshed] = useState(false);

  useEffect(() => {
    const wasFetching = wasFetchingRef.current;
    wasFetchingRef.current = query.isFetching;

    // Only flash on a real network refetch landing (background poll, verify
    // refetch, anniversary bonus) — not on our own synchronous optimistic
    // cache writes, which never toggle isFetching. TRD §5.2.
    if (wasFetching && !query.isFetching) {
      const current = query.data?.balance;
      const previous = previousBalanceRef.current;
      if (previous !== undefined && current !== undefined && current !== previous) {
        setJustRefreshed(true);
        const timeout = setTimeout(() => setJustRefreshed(false), 4000);
        return () => clearTimeout(timeout);
      }
    }
  }, [query.isFetching, query.data]);

  useEffect(() => {
    previousBalanceRef.current = query.data?.balance;
  }, [query.data?.balance]);

  let status = "loading";
  if (query.isError && query.error?.status === 404) status = "empty";
  else if (query.data) status = "ready";

  return (
    <BalanceCard
      locationName={location.name}
      status={status}
      balance={query.data?.balance}
      isStale={query.isStale}
      justRefreshed={justRefreshed}
      integritySuspect={Boolean(integrity?.suspect)}
      expectedBalance={integrity?.expected}
      accentIndex={accentIndex}
    />
  );
}
