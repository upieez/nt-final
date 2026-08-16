import { useCallback, useState } from 'react';
import { postJson } from './api.js';
import { buildRequest } from './preferences.js';

export default function useRecommendation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const recommend = useCallback(async (sequence, preferences, options) => {
    setLoading(true);
    setError(null);
    try {
      const body = await postJson('/api/v1/recommendations/next-track', buildRequest(sequence, preferences, options));
      setResult(body);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, error, result, recommend, reset };
}
