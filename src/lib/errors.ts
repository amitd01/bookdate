/** Turns low-level errors into messages people can act on. */
const OFFLINE = /network request failed|fetch failed|unable to resolve host|unknownhost|timed? ?out|appears to be offline|failed to connect/i;

export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.') {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (OFFLINE.test(msg)) return "Couldn't reach BookDate. Check your internet connection and try again.";
  return msg || fallback;
}
