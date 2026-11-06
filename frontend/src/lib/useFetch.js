import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../api/client';

// Small data hook: GET a URL, expose loading/error and a reload function.
export default function useFetch(url, { params, skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const key = JSON.stringify(params || {});
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (skip || !url) return;
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: JSON.parse(key) });
      if (mine === seq.current) setData(res.data);
    } catch (err) {
      if (mine === seq.current) setError(errorMessage(err));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [url, key, skip]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}
