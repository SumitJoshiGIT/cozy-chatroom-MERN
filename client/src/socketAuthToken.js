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

const INVITE_KEY = 'lavender-invite';

// Kept in sessionStorage so an invite survives the sign-in redirect.
export function captureInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('invite');
  if (!code) return;
  sessionStorage.setItem(INVITE_KEY, code);
  params.delete('invite');
  const search = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (search ? `?${search}` : ''));
}

export function takeInvite() {
  const code = sessionStorage.getItem(INVITE_KEY);
  sessionStorage.removeItem(INVITE_KEY);
  return code;
}

export function getStoredAuthToken() {
  return localStorage.getItem(STORAGE_KEY);
}

export function storeAuthToken(token) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearStoredAuthToken() {
  localStorage.removeItem(STORAGE_KEY);
}
