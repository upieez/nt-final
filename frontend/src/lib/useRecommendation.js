import { useCallback, useRef, useState } from 'react';
import { postJson } from './api.js';
import { buildRequest } from './preferences.js';

export default function useRecommendation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const ticket = useRef(0);

  const recommend = useCallback(async (sequence, preferences, options) => {
    const mine = ++ticket.current;
    setLoading(true);
    setError(null);
    try {
      const body = await postJson('/api/v1/recommendations/next-track', buildRequest(sequence, preferences, options));
      if (mine === ticket.current) setResult(body);
    } catch (err) {
      if (mine === ticket.current) setError(err);
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    ticket.current += 1;
    setLoading(false);
    setResult(null);
    setError(null);
  }, []);

  return { loading, error, result, recommend, reset };
}
