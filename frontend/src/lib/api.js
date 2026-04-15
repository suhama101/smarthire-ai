function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

export function getFrontendOrigin() {
  const configuredOrigin = normalizeOrigin(
    process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || process.env.BACKEND_API_URL
  );

  if (configuredOrigin) {
    return configuredOrigin;
  }

  return '';
}

export function getApiBaseUrl() {
  return `${getFrontendOrigin()}/api`;
}

export function getApiUrl(path = '') {
  const normalizedPath = String(path || '').replace(/^\//, '');

  if (!normalizedPath) {
    return getApiBaseUrl();
  }

  return `${getApiBaseUrl()}/${normalizedPath}`;
}