import Game4SpecialPrizeUser from '../../models/game4SpecialPrizeUserModel.js';

const GAME_4_SPECIAL_PRIZE_USER_CACHE_TTL_MS = 60 * 1000;

class Game4SpecialPrizeUserCache {
  constructor() {
    this.users = new Set();
    this.loaded = false;
    this.loadedAt = null;
    this.loadingPromise = null;
  }

  normalizeUser(user) {
    return String(user || '').trim();
  }

  isFresh() {
    return this.loaded &&
      this.loadedAt &&
      Date.now() - this.loadedAt.getTime() < GAME_4_SPECIAL_PRIZE_USER_CACHE_TTL_MS;
  }

  async loadFromDatabase() {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      const rows = await Game4SpecialPrizeUser.findAll({
        attributes: ['user'],
        where: { active: 1 },
        raw: true,
        order: [['user', 'ASC']],
      });

      this.users.clear();

      for (const row of rows) {
        const user = this.normalizeUser(row.user);

        if (user) {
          this.users.add(user);
        }
      }

      this.loaded = true;
      this.loadedAt = new Date();
      console.log(`[Game4SpecialPrizeUserCache] ${this.users.size} beneficiarios cargados en memoria`);
    })();

    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  async ensureFresh() {
    if (this.isFresh()) {
      return;
    }

    await this.loadFromDatabase();
  }

  async has(user) {
    await this.ensureFresh();
    return this.users.has(this.normalizeUser(user));
  }

  getStats() {
    return {
      users: this.users.size,
      loaded: this.loaded,
      loadedAt: this.loadedAt,
    };
  }
}

const game4SpecialPrizeUserCache = new Game4SpecialPrizeUserCache();
export default game4SpecialPrizeUserCache;
