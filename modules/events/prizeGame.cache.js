import PrizesGame from '../../models/prizesGamesModel.js';

class PrizeGameCache {
  constructor() {
    this.prizesById = new Map(); // id -> prize
    this.prizesByGame = new Map(); // type_game -> prizes[]
    this.loaded = false;
    this.loadedAt = null;
    this.loadingPromise = null;
  }

  normalize(prize) {
    const plain = typeof prize.get === 'function' ? prize.get({ plain: true }) : prize;

    return {
      id: Number(plain.id),
      orderPrize: Number(plain.orderPrize),
      name: plain.name,
      type: Number(plain.type),
      clase: plain.clase === null ? null : Number(plain.clase),
      prize: Number(plain.prize),
      url: plain.url || '',
      probability: Number(plain.probability || 0),
      mode: Number(plain.mode || 0),
      type_game: Number(plain.type_game),
      limite: Number(plain.limite || 0),
      users: Number(plain.users || 0),
    };
  }

  clone(prize) {
    return prize ? { ...prize } : null;
  }

  sortGamePrizes(game) {
    const gameKey = Number(game);
    const prizes = this.prizesByGame.get(gameKey);

    if (!prizes) {
      return;
    }

    prizes.sort((a, b) => {
      const classA = a.clase === null ? 0 : a.clase;
      const classB = b.clase === null ? 0 : b.clase;

      if (classA !== classB) {
        return classA - classB;
      }

      return a.orderPrize - b.orderPrize;
    });
  }

  async loadFromDatabase() {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      const rows = await PrizesGame.findAll({
        raw: true,
        order: [
          ['type_game', 'ASC'],
          ['clase', 'ASC'],
          ['orderPrize', 'ASC'],
        ],
      });

      this.prizesById.clear();
      this.prizesByGame.clear();

      for (const row of rows) {
        this.addOrUpdate(row);
      }

      this.loaded = true;
      this.loadedAt = new Date();
      console.log(`[PrizeGameCache] ${this.prizesById.size} premios cargados en memoria`);
    })();

    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  async ensureLoaded() {
    if (this.loaded) {
      return;
    }

    await this.loadFromDatabase();
  }

  addOrUpdate(prize) {
    const normalized = this.normalize(prize);

    if (!normalized.id || !normalized.type_game) {
      return null;
    }

    const previous = this.prizesById.get(normalized.id);

    if (previous) {
      const previousGamePrizes = this.prizesByGame.get(previous.type_game) || [];
      this.prizesByGame.set(
        previous.type_game,
        previousGamePrizes.filter((item) => item.id !== normalized.id)
      );
    }

    this.prizesById.set(normalized.id, normalized);

    const gamePrizes = this.prizesByGame.get(normalized.type_game) || [];
    gamePrizes.push(normalized);
    this.prizesByGame.set(normalized.type_game, gamePrizes);
    this.sortGamePrizes(normalized.type_game);

    return this.clone(normalized);
  }

  remove(id) {
    const normalizedId = Number(id);
    const prize = this.prizesById.get(normalizedId);

    if (!prize) {
      return;
    }

    this.prizesById.delete(normalizedId);

    const gamePrizes = this.prizesByGame.get(prize.type_game) || [];
    this.prizesByGame.set(
      prize.type_game,
      gamePrizes.filter((item) => item.id !== normalizedId)
    );
  }

  getById(id) {
    return this.clone(this.prizesById.get(Number(id)) || null);
  }

  getByGame(game) {
    const prizes = this.prizesByGame.get(Number(game)) || [];
    return prizes.map((prize) => this.clone(prize));
  }

  getByGameAndOrder(game, orderPrize) {
    return this.getByGame(game).filter(
      (prize) => prize.orderPrize === Number(orderPrize)
    );
  }

  getAll() {
    return [...this.prizesById.values()].map((prize) => this.clone(prize));
  }

  getStats() {
    return {
      prizes: this.prizesById.size,
      games: this.prizesByGame.size,
      loaded: this.loaded,
      loadedAt: this.loadedAt,
    };
  }
}

const prizeGameCache = new PrizeGameCache();
export default prizeGameCache;
