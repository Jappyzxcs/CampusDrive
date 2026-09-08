import { useEffect, useRef, useState } from 'react';

/**
 * Runs an async fetcher on mount (and whenever `deps` changes), exposing
 * { data, isLoading, error, refetch }. Every page in the student/admin/
 * guard modules uses this instead of hand-rolling its own effect, so
 * loading/error handling stays consistent.
 *
 * const { data, isLoading } = useAsyncData(() => mockDataService.getVehicles({ ownerId }), [ownerId]);
 */
export function useAsyncData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (isMounted) setData(result);
      })
      .catch((err) => {
        if (isMounted) setError(err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  function refetch() {
    setReloadToken((t) => t + 1);
  }

  return { data, isLoading, error, refetch };
}
