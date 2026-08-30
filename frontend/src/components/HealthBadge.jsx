import { useEffect, useState } from 'react';

export default function HealthBadge() {
  const [health, setHealth] = useState({ state: 'checking' });

  useEffect(() => {
    let cancelled = false;
    fetch('/health', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body) => { if (!cancelled) setHealth({ state: 'up', offline: Boolean(body.offline) }); })
      .catch(() => { if (!cancelled) setHealth({ state: 'down' }); });
    return () => { cancelled = true; };
  }, []);

  if (health.state === 'checking') return <span className="health health-checking">Checking backend...</span>;
  if (health.state === 'down') return <span className="health health-down">Backend unreachable</span>;
  return (
    <span className={`health ${health.offline ? 'health-offline' : 'health-up'}`}>
      {health.offline ? 'Backend up, offline mode (cache only)' : 'Backend up'}
    </span>
  );
}
