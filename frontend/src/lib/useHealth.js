import { useEffect, useState } from 'react';
import { getHealth } from './api.js';

export default function useHealth() {
  const [health, setHealth] = useState({ state: 'checking', offline: false });
  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((body) => { if (!cancelled) setHealth({ state: 'up', offline: Boolean(body.offline) }); })
      .catch(() => { if (!cancelled) setHealth({ state: 'down', offline: false }); });
    return () => { cancelled = true; };
  }, []);
  return health;
}
