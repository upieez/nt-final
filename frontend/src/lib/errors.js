const MESSAGES = {
  404: 'The server answered but the endpoint is missing. Restart the backend.',
  0: 'Could not reach the NextTrack server. Check that the backend is running on port 3000.',
  400: 'The request was not valid. Check the sequence and preferences and try again.',
  422: 'The tracks in your sequence could not be identified in the music databases, so there is nothing to recommend from. Check spelling or try different tracks.',
  502: 'A music data source did not answer properly. Try again in a moment.',
  504: 'A music data source took too long to answer. Try again, or switch to the fixed candidate pool.'
};

export function describeError(err) {
  const status = err && typeof err.status === 'number' ? err.status : -1;
  const body = (err && err.body) || {};
  const headline = MESSAGES[status] || 'Something went wrong while asking for a recommendation.';
  const details = [];
  if (Array.isArray(body.details)) body.details.forEach((d) => details.push(String(d)));
  if (Array.isArray(body.warnings)) {
    body.warnings.forEach((w) => details.push(w.track ? `${w.track}: ${w.issue}` : String(w.issue || w)));
  }
  if (body.source) details.push(`Source: ${body.source}`);
  return { status, headline, details };
}
