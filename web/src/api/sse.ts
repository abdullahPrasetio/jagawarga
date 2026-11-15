import { getAccessToken, onTokenChange } from './client';

export type StreamEvent = { event: string; data: Record<string, unknown> };

/**
 * SSE lewat fetch karena `EventSource` tidak bisa mengirim header
 * Authorization. Reconnect backoff 1→2→4→8→30 detik.
 */
export function subscribeEvents(onEvent: (event: StreamEvent) => void): () => void {
  let active = true;
  let controller: AbortController | null = null;
  let retryTimer: number | undefined;
  let attempt = 0;
  let lastEventId: string | null = null;

  async function connect() {
    if (!active) return;
    controller = new AbortController();
    const token = getAccessToken();
    if (!token) {
      schedule();
      return;
    }

    try {
      const response = await fetch('/api/v1/events/stream', {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'text/event-stream',
          ...(lastEventId ? { 'last-event-id': lastEventId } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);

      attempt = 0;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (active) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let index = buffer.indexOf('\n\n');

        while (index >= 0) {
          const frame = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          index = buffer.indexOf('\n\n');

          let event = 'message';
          let id: string | null = null;
          const dataLines: string[] = [];

          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            if (line.startsWith('id:')) id = line.slice(3).trim();
            if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
          }

          if (id) lastEventId = id;
          if (event === 'ping' || event === 'ready' || dataLines.length === 0) continue;

          try {
            onEvent({ event, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> });
          } catch {
            // frame rusak: abaikan, koneksi tetap hidup
          }
        }
      }
    } catch {
      // dijadwalkan ulang di bawah
    }

    schedule();
  }

  function schedule() {
    if (!active) return;
    const delays = [1000, 2000, 4000, 8000, 30000];
    const delay = delays[Math.min(attempt, delays.length - 1)];
    attempt += 1;
    retryTimer = window.setTimeout(connect, delay);
  }

  connect();

  const unsubscribeToken = onTokenChange(() => {
    controller?.abort();
    attempt = 0;
    window.clearTimeout(retryTimer);
    schedule();
  });

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    controller?.abort();
    attempt = 0;
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    active = false;
    unsubscribeToken();
    document.removeEventListener('visibilitychange', onVisible);
    window.clearTimeout(retryTimer);
    controller?.abort();
  };
}
