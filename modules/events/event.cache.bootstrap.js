import prizeGameCache from './prizeGame.cache.js';
import configParameterCache from './configParameter.cache.js';

export async function bootstrapEventCache() {
  await configParameterCache.loadFromDatabase();
  await prizeGameCache.loadFromDatabase();
}

export const initEventCache = bootstrapEventCache;
