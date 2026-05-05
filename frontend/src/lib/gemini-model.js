const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_GEMINI_MODELS = [DEFAULT_GEMINI_MODEL, 'gemini-2.5-flash-lite'];
const TRANSIENT_RETRY_LIMIT = 2;

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function looksLikeMissingModelError(error) {
  const message = String(error?.message || '');

  return /404 Not Found|not found for API version|not supported for generateContent|model .* not found/i.test(message);
}

function looksLikeTransientAvailabilityError(error) {
  const message = String(error?.message || '');
  const status = Number(error?.status || error?.response?.status || 0);

  return status === 429 || status === 503 || /429 Too Many Requests|503 Service Unavailable|high demand|temporarily unavailable|try again later/i.test(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getGeminiModelCandidates() {
  const configuredModel = String(process.env.GEMINI_MODEL || '').trim();
  const candidates = configuredModel && FALLBACK_GEMINI_MODELS.includes(configuredModel)
    ? [configuredModel, ...FALLBACK_GEMINI_MODELS]
    : FALLBACK_GEMINI_MODELS;

  return uniqueStrings(candidates);
}

export async function generateGeminiContent(genAI, prompt) {
  const candidates = getGeminiModelCandidates();
  let lastError = null;

  for (const modelName of candidates) {
    for (let attempt = 0; attempt <= TRANSIENT_RETRY_LIMIT; attempt += 1) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        return await model.generateContent(prompt);
      } catch (error) {
        lastError = error;

        const shouldRetry = looksLikeMissingModelError(error) || looksLikeTransientAvailabilityError(error);
        const isFinalAttempt = attempt >= TRANSIENT_RETRY_LIMIT;

        if (!shouldRetry) {
          throw error;
        }

        if (looksLikeTransientAvailabilityError(error) && !isFinalAttempt) {
          await sleep(1000 * (attempt + 1));
          continue;
        }

        if (modelName === candidates[candidates.length - 1]) {
          throw error;
        }

        break;
      }
    }
  }

  throw lastError || new Error('Gemini request failed.');
}