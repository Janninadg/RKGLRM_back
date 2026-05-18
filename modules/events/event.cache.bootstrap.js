import prizeGameCache from './prizeGame.cache.js';
import configParameterCache from './configParameter.cache.js';
import eventTestUserCache from './eventTestUser.cache.js';

export async function bootstrapEventCache() {
  await configParameterCache.loadFromDatabase();
  await prizeGameCache.loadFromDatabase();
  await eventTestUserCache.loadFromDatabase();
}

export const initEventCache = bootstrapEventCache;
