const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_GEMINI_MODELS = [DEFAULT_GEMINI_MODEL, 'gemini-2.0-flash'];

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function looksLikeMissingModelError(error) {
  const message = String(error?.message || '');

  return /404 Not Found|not found for API version|not supported for generateContent|model .* not found/i.test(message);
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
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await model.generateContent(prompt);
    } catch (error) {
      lastError = error;

      if (!looksLikeMissingModelError(error) || modelName === candidates[candidates.length - 1]) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Gemini request failed.');
}