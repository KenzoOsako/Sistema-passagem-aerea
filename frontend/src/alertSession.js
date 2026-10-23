// Fetch supports bearer headers without putting session tokens in URLs.
export function startAlertSession({ apiUrl, token, onAlerts, onAlert, onUnauthorized,
  fetchImpl = fetch, retryMs = 3000 }) {
  if (!token) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  let retry;
  const headers = { Authorization: `Bearer ${token}` };
  const wait = () => new Promise(resolve => {
    const finish = () => { clearTimeout(retry); signal.removeEventListener('abort', finish); resolve(); };
    signal.addEventListener('abort', finish, { once: true });
    retry = setTimeout(finish, retryMs);
    if (signal.aborted) finish();
  });
  const authorized = response => {
    if (response.status === 401 || response.status === 403) {
      if (!signal.aborted) onUnauthorized();
      controller.abort();
      return false;
    }
    if (!response.ok) throw new Error('Alert service unavailable');
    return true;
  };
  const run = async () => {
    while (!signal.aborted) {
      try {
        const alerts = await fetchImpl(`${apiUrl}/api/alerts`, { headers, signal });
        if (!authorized(alerts)) return;
        const data = await alerts.json();
        if (signal.aborted) return;
        onAlerts(data);
        const response = await fetchImpl(`${apiUrl}/api/stream`, {
          headers: { ...headers, Accept: 'text/event-stream' }, signal,
        });
        if (!authorized(response)) return;
        if (!response.headers.get('content-type')?.startsWith('text/event-stream')) {
          throw new Error('Invalid alert stream');
        }
        await readAlertStream(response.body, signal, onAlert);
      } catch {
        // Network/service errors may reconnect; authentication errors stop above.
        if (signal.aborted) return;
      }
      await wait();
    }
  };
  void run();
  return () => controller.abort();
}

export async function readAlertStream(body, signal, onAlert) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done || signal.aborted) return;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 4 * 1024 * 1024) throw new Error('Alert event too large');
      let boundary;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (!data || signal.aborted) continue;
        let event;
        try { event = JSON.parse(data); } catch { continue; }
        if (event?.type === 'ALERT') onAlert(event);
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
