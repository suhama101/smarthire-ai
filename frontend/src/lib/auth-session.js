const AUTH_SESSION_KEY = 'smarthire.auth';
const AUTH_COOKIE_NAME = 'smarthire.auth';
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function decodeJwtPayload(token) {
  const rawToken = String(token || '').trim();

  if (!rawToken || !rawToken.includes('.')) {
    return null;
  }

  try {
    const payloadPart = rawToken.split('.')[1];
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8');

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeAuthSession(session) {
  const nextSession = session && typeof session === 'object' ? { ...session } : null;

  if (!nextSession?.token) {
    return nextSession;
  }

  const tokenPayload = decodeJwtPayload(nextSession.token);
  const currentUser = nextSession.user && typeof nextSession.user === 'object' ? { ...nextSession.user } : null;

  if (!currentUser) {
    nextSession.user = tokenPayload ? {
      id: tokenPayload.id || tokenPayload.sub || '',
      email: tokenPayload.email || '',
      role: tokenPayload.role || '',
    } : null;

    return nextSession;
  }

  if (!currentUser.id) {
    currentUser.id = tokenPayload?.id || tokenPayload?.sub || currentUser.email || currentUser.full_name || '';
  }

  if (!currentUser.email) {
    currentUser.email = tokenPayload?.email || '';
  }

  if (!currentUser.role) {
    currentUser.role = tokenPayload?.role || '';
  }

  nextSession.user = currentUser;
  return nextSession;
}

function getCookieAttributes(isClearing = false) {
  const isSecureContext = typeof window !== 'undefined'
    ? window.location.protocol === 'https:'
    : process.env.NODE_ENV === 'production';

  const sameSite = isSecureContext ? 'none' : 'lax';
  const parts = ['path=/'];

  if (isClearing) {
    parts.push('max-age=0');
  } else {
    parts.push(`max-age=${AUTH_COOKIE_MAX_AGE}`);
  }

  parts.push(`samesite=${sameSite}`);

  if (isSecureContext) {
    parts.push('secure');
  }

  return parts.join('; ');
}

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
      return normalizeAuthSession(JSON.parse(raw));
    }

    const token = readCookie(AUTH_COOKIE_NAME);
    return token ? normalizeAuthSession({ token, user: null }) : null;
  } catch {
    return null;
  }
}

function updateAuthCookie(token) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; ${getCookieAttributes(false)}`;
}

function clearAuthCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; ${getCookieAttributes(true)}`;
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