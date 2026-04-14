const AUTH_SESSION_KEY = 'smarthire.auth';
const AUTH_COOKIE_NAME = 'smarthire.auth';
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function readCookie(name) {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookieEntry = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));

  if (!cookieEntry) {
    return null;
  }

  return decodeURIComponent(cookieEntry.slice(name.length + 1));
}

export function readStoredAuth() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      return JSON.parse(raw);
    }

    const token = readCookie(AUTH_COOKIE_NAME);
    return token ? { token, user: null } : null;
  } catch {
    return null;
  }
}

function updateAuthCookie(token) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; samesite=lax`;
}

function clearAuthCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

export function persistAuthSession(session) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));

  if (session?.token) {
    updateAuthCookie(session.token);
  }

  window.dispatchEvent(new Event('smarthire-auth-changed'));
}

export function clearAuthSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    window.dispatchEvent(new Event('smarthire-auth-changed'));
  }

  clearAuthCookie();
}