const SESSION_KEY = 'session_id';

function getSessionId() {
  try {
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId && typeof sessionId === 'string' && sessionId.trim()) {
      return sessionId;
    }
  } catch (err) {
    console.warn('Failed to read session_id from localStorage', err);
  }

  try {
    const newId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, newId);
    return newId;
  } catch (err) {
    console.error('Unable to generate session ID', err);
    return null;
  }
}

function getSessionHeaders() {
  const sessionId = getSessionId();
  return sessionId ? { 'X-Session-ID': sessionId } : {};
}

function isApiUrl(input) {
  try {
    const url = typeof input === 'string' ? input : input.url;
    if (!url) return false;
    if (url.startsWith('/api/')) return true;
    const parsed = new URL(url, window.location.href);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch (err) {
    return false;
  }
}

const originalFetch = window.fetch.bind(window);

function fetchWithSession(input, init = {}) {
  if (!isApiUrl(input)) {
    return originalFetch(input, init);
  }

  const headers = new Headers(init.headers || {});
  const sessionId = getSessionId();
  if (sessionId) {
    headers.set('X-Session-ID', sessionId);
  }

  const updatedInit = Object.assign({}, init, { headers });
  return originalFetch(input, updatedInit);
}

window.getSessionId = getSessionId;
window.getSessionHeaders = getSessionHeaders;
window.fetchWithSession = fetchWithSession;
window.fetch = fetchWithSession;
