import { useEffect, useState } from "react";

/** Loading/error/data for one fetch, re-run when `deps` changes. Exists so a
 * failed request (expired token, network blip, 500) shows something instead
 * of a silently blank screen — see Pipelines.tsx, which shipped without this
 * once and went blank on an expired dev token with zero on-screen explanation. */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setError(null);
    fn()
      .then((d) => { if (active) setData(d); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load."); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}
