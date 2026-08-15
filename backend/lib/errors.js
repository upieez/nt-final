class ApiError extends Error {
  constructor(status, body) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

function validationError(details) {
  return new ApiError(400, { error: 'Invalid request', details });
}

function unresolvableError(message, warnings) {
  return new ApiError(422, { error: message, warnings });
}

// Timeouts map to 504 and any other upstream failure to 502, naming the source that failed
function upstreamError(failure) {
  const status = failure.status === 'timeout' ? 504 : 502;
  const error = status === 504 ? `Upstream request to ${failure.source} timed out` : `Upstream request to ${failure.source} failed`;
  return new ApiError(status, { error, source: failure.source });
}

module.exports = { ApiError, validationError, unresolvableError, upstreamError };
