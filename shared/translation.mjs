export class TranslationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export async function translationKey(text, target) {
  const bytes = new TextEncoder().encode(`fr:${target}:${text}`);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export function splitTranslationText(text, maxBytes = 460) {
  const chunks = [];
  let part = '';
  for (const token of String(text).match(/\S+\s*|\s+/gu) || []) {
    if (new TextEncoder().encode(part + token).length <= maxBytes) {
      part += token;
      continue;
    }
    if (part) {
      chunks.push(part);
      part = '';
    }
    for (const character of token) {
      if (new TextEncoder().encode(part + character).length > maxBytes) {
        chunks.push(part);
        part = '';
      }
      part += character;
    }
  }
  if (part) chunks.push(part);
  return chunks;
}
function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => {
      const number = Number(n);
      return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
    })
    .replace(
      /&(amp|quot|apos|lt|gt);/g,
      (_, key) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[key]
    );
}
export async function translateChunk(text, target, fetcher = fetch, config = {}) {
  if (!['en', 'zh'].includes(target)) throw new TranslationError('unsupported');
  if (config.provider === 'libretranslate') {
    const endpoint = new URL('translate', `${config.url.replace(/\/$/, '')}/`);
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'fr',
        target,
        format: 'text',
        ...(config.key ? { api_key: config.key } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 429) throw new TranslationError('quota');
    if (!response.ok) throw new TranslationError('unavailable');
    const data = await response.json();
    if (typeof data.translatedText !== 'string' || !data.translatedText.trim())
      throw new TranslationError('unavailable');
    return decodeEntities(data.translatedText);
  }
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `fr|${target === 'zh' ? 'zh-CN' : 'en'}`);
  const response = await fetcher(url, { signal: AbortSignal.timeout(20000) });
  if (response.status === 429) throw new TranslationError('quota');
  if (!response.ok) throw new TranslationError('unavailable');
  const data = await response.json();
  if (data.quotaFinished || Number(data.responseStatus) === 429)
    throw new TranslationError('quota');
  if (
    Number(data.responseStatus) !== 200 ||
    typeof data.responseData?.translatedText !== 'string' ||
    !data.responseData.translatedText.trim()
  )
    throw new TranslationError('unavailable');
  return decodeEntities(data.responseData.translatedText);
}
export function createTranslator({ cache, fetcher = fetch, config = {} } = {}) {
  const pending = new Map();
  let quotaUntil = 0;
  async function cached(text, target, chunk) {
    const key = `${chunk ? 'chunk' : 'text'}:${config.provider || 'mymemory'}:${await translationKey(text, target)}`;
    const prior = await cache?.get(key);
    if (prior?.text) return prior;
    if (pending.has(key)) return pending.get(key);
    const promise = (async () => {
      let translated;
      if (chunk) {
        if (Date.now() < quotaUntil) throw new TranslationError('quota');
        try {
          translated = await translateChunk(text, target, fetcher, config);
        } catch (error) {
          if (error.code === 'quota') quotaUntil = Date.now() + 15 * 60000;
          throw error;
        }
      } else {
        const parts = [];
        for (const part of splitTranslationText(text))
          parts.push((await cached(part, target, true)).text);
        translated = parts.join(' ');
      }
      const value = {
        text: translated,
        provider: config.provider || 'mymemory',
        machine: true,
        translatedAt: new Date().toISOString(),
      };
      await cache?.set(key, value);
      return value;
    })().finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  return {
    async translate(text, target) {
      if (!text?.trim()) return { text: '', machine: false };
      if (target === 'fr') return { text, machine: false };
      return cached(text, target, false);
    },
  };
}

export async function translateEvent(event, target, translator, { full = false } = {}) {
  if (target === 'fr') return event;
  const next = {
    ...event,
    title: { ...event.title },
    description: { ...event.description },
    detailsTranslations: { ...event.detailsTranslations },
    translationStatus: { ...event.translationStatus },
  };
  const fields = full ? ['title', 'description'] : ['title'];
  try {
    let metadata;
    for (const field of fields) {
      const value =
        event.translationStatus?.[target]?.status === 'ready' && event[field]?.[target]
          ? { text: event[field][target], ...event.translationStatus[target] }
          : await translator.translate(event[field]?.fr || '', target);
      next[field][target] = value.text;
      metadata = value;
    }
    if (full) {
      next.detailsTranslations[target] = {};
      for (const field of ['dateDescription', 'price']) {
        const knownPrice =
          field === 'price' &&
          {
            gratuit: { en: 'Free admission', zh: '免费入场' },
            payant: { en: 'Paid admission', zh: '收费入场' },
          }[event.price?.trim().toLowerCase()];
        next.detailsTranslations[target][field] = knownPrice
          ? knownPrice[target]
          : (await translator.translate(event[field] || '', target)).text;
      }
    }
    next.translationStatus[target] = {
      status: 'ready',
      full,
      provider: metadata?.provider || 'mymemory',
      translatedAt: metadata?.translatedAt,
      machine: true,
    };
  } catch (error) {
    next.translationStatus[target] = {
      status: 'failed',
      code: error.code || 'unavailable',
      full,
      machine: true,
    };
  }
  return next;
}
