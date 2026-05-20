import recargasPackCache from './recargasPack.cache.js';

export async function bootstrapGMCache() {
  await recargasPackCache.loadFromDatabase();
}

export const initGMCache = bootstrapGMCache;
