const fallbackVisitor = crypto.randomUUID();
function visitor() {
  try {
    const id = localStorage.getItem('cafes-reading-visitor') || fallbackVisitor;
    localStorage.setItem('cafes-reading-visitor', id);
    return id;
  } catch {
    return fallbackVisitor;
  }
}
export function liked(id) {
  try {
    return localStorage.getItem(`cafes-liked:${id}`) === 'true';
  } catch {
    return false;
  }
}
export async function libraryMetrics() {
  const response = await fetch('/api/library', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Statistics unavailable');
  return response.json();
}
export async function recordReading(id, kind, active) {
  const response = await fetch('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, kind, active, visitor: visitor() }),
    keepalive: true,
  });
  if (!response.ok) throw new Error('Statistics unavailable');
  if (kind === 'like')
    try {
      localStorage.setItem(`cafes-liked:${id}`, String(active));
    } catch {
      /* Optional device memory. */
    }
  return response.json();
}
