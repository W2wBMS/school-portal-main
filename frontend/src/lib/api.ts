/**
 * Safely parses a fetch Response as JSON or extracts a meaningful, user-friendly
 * error message when the server returns HTML (e.g. Render 502/503/504 Bad Gateway /
 * Gateway Timeout during free-tier cold starts).
 */
export async function parseJsonResponse<T = any>(
  response: Response,
  defaultError = 'Request failed'
): Promise<T> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || defaultError);
      }
      return data as T;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message !== defaultError &&
        !err.message.includes('JSON') &&
        !err.message.includes('is not valid JSON')
      ) {
        throw err;
      }
      // If parsing failed or threw a JSON syntax error, continue to fallback below
    }
  }

  // Non-JSON response received (usually HTML error from host/proxy)
  if (!response.ok) {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new Error(
        'The server is currently waking up or temporarily unavailable. Please wait 30 seconds and try again.'
      );
    }
    if (response.status === 404) {
      throw new Error('The requested service endpoint was not found.');
    }
    throw new Error(`Server returned error (${response.status}). Please try again.`);
  }

  throw new Error('Received an invalid response format from the server.');
}
