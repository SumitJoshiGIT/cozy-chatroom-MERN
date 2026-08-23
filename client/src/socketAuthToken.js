const STORAGE_KEY = 'lavender-socket-token';

export function captureAuthTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('st');
  if (token) {
    localStorage.setItem(STORAGE_KEY, token);
    params.delete('st');
    const search = params.toString();
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (search ? `?${search}` : '') + window.location.hash
    );
  }
}

export function getStoredAuthToken() {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearStoredAuthToken() {
  localStorage.removeItem(STORAGE_KEY);
}
