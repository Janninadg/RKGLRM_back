class PublicDataCache {
  constructor() {
    this.entries = new Map();
  }

  clone(value) {
    if (value === null || value === undefined) {
      return value;
    }

    return JSON.parse(JSON.stringify(value));
  }

  isFresh(entry) {
    return entry && entry.expiresAt > Date.now();
  }

  getLabel(key) {
    if (key.startsWith(PUBLIC_CACHE_KEYS.EVENTS)) return 'eventos';
    if (key.startsWith(PUBLIC_CACHE_KEYS.LINKS)) return 'links';
    if (key.startsWith(PUBLIC_CACHE_KEYS.ANNOUNCEMENTS)) return 'anuncios';
    if (key.startsWith(PUBLIC_CACHE_KEYS.ASSETS)) return 'assets';
    if (key.startsWith(PUBLIC_CACHE_KEYS.STREAMERS)) return 'streamers';
    if (key.startsWith(PUBLIC_CACHE_KEYS.STAGES)) return 'stages';
    if (key.startsWith(PUBLIC_CACHE_KEYS.SECURITY_QUESTIONS)) return 'preguntas de seguridad';
    if (key.startsWith(PUBLIC_CACHE_KEYS.RANKING_CHARACTERS)) return 'ranking personajes';
    if (key.startsWith(PUBLIC_CACHE_KEYS.RANKING_CLANS)) return 'ranking clanes';
    if (key.startsWith(PUBLIC_CACHE_KEYS.MARKET_PAYMENTS)) return 'metodos de pago';
    if (key.startsWith(PUBLIC_CACHE_KEYS.LOAN_ITEMS)) return 'items para prestamos';
    if (key.startsWith(PUBLIC_CACHE_KEYS.FORUM_CATEGORIES)) return 'categorias del foro';
    if (key.startsWith(PUBLIC_CACHE_KEYS.FORUM_LATEST_POSTS)) return 'ultimos posts';
    if (key.startsWith(PUBLIC_CACHE_KEYS.FORUM_POSTS_BY_CATEGORY)) return 'posts por categoria';

    return key;
  }

  count(value) {
    if (Array.isArray(value)) {
      return value.length;
    }

    if (value && typeof value === 'object') {
      if (Array.isArray(value.data)) return value.data.length;
      if (Array.isArray(value.rows)) return value.rows.length;
      return Object.keys(value).length;
    }

    return value === null || value === undefined ? 0 : 1;
  }

  logLoaded(key, value) {
    console.log(`[PublicDATA] ${this.count(value)} ${this.getLabel(key)} cargados en memoria`);
  }

  async getOrLoad(key, ttlMs, loader) {
    const entry = this.entries.get(key);

    if (this.isFresh(entry)) {
      return this.clone(entry.value);
    }

    if (entry?.promise) {
      return this.clone(await entry.promise);
    }

    const promise = Promise.resolve()
      .then(loader)
      .then((value) => {
        const plainValue = this.clone(value);

        this.entries.set(key, {
          value: plainValue,
          loadedAt: new Date(),
          expiresAt: Date.now() + ttlMs,
          promise: null,
        });

        this.logLoaded(key, plainValue);

        return plainValue;
      })
      .catch((error) => {
        if (entry?.value !== undefined) {
          this.entries.set(key, entry);
        } else {
          this.entries.delete(key);
        }

        throw error;
      });

    this.entries.set(key, {
      value: entry?.value,
      loadedAt: entry?.loadedAt || null,
      expiresAt: entry?.expiresAt || 0,
      promise,
    });

    return this.clone(await promise);
  }

  invalidate(key) {
    this.entries.delete(key);
  }

  invalidateMany(keys) {
    keys.forEach((key) => this.invalidate(key));
  }

  invalidatePrefix(prefix) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  invalidatePrefixes(prefixes) {
    prefixes.forEach((prefix) => this.invalidatePrefix(prefix));
  }

  clear() {
    this.entries.clear();
  }

  getStats() {
    return [...this.entries.entries()].map(([key, entry]) => ({
      key,
      loadedAt: entry.loadedAt,
      expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
      pending: Boolean(entry.promise),
    }));
  }
}

export const PUBLIC_CACHE_KEYS = {
  EVENTS: 'events:all',
  LINKS: 'web:links',
  ANNOUNCEMENTS: 'web:announcements',
  ASSETS: 'web:assets',
  STREAMERS: 'web:streamers',
  STAGES: 'web:stages',
  SECURITY_QUESTIONS: 'users:security-questions',
  RANKING_CHARACTERS: 'users:ranking:characters',
  RANKING_CLANS: 'users:ranking:clans',
  MARKET_PAYMENTS: 'market:payments',
  LOAN_ITEMS: 'gm:loan-items',
  FORUM_CATEGORIES: 'forum:categories',
  FORUM_LATEST_POSTS: 'forum:latest-posts',
  FORUM_POSTS_BY_CATEGORY: 'forum:posts-by-category',
};

export const PUBLIC_CACHE_TTL = {
  SHORT: 60 * 1000,
  RANKING: 2 * 60 * 1000,
  MEDIUM: 5 * 60 * 1000,
  LONG: 30 * 60 * 1000,
  VLONG: 720 * 60 * 1000,
};

const publicDataCache = new PublicDataCache();
export default publicDataCache;
