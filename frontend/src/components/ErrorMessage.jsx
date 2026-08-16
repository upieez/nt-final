import { describeError } from '../lib/errors.js';

export default function ErrorMessage({ error }) {
  if (!error) return null;
  const { status, headline, details } = describeError(error);
  return (
    <div className="error" role="alert">
      <p className="error-headline">{headline}</p>
      {details.length > 0 && (
        <ul className="error-details">
          {details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
      {status > 0 && <p className="small muted">HTTP {status}</p>}
    </div>
  );
}
