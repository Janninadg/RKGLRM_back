import RecargasPack from '../../models/recargasPackModel.js';

class RecargasPackCache {
  constructor() {
    this.packsById = new Map();
    this.loaded = false;
    this.loadedAt = null;
    this.loadingPromise = null;
  }

  normalize(pack) {
    const plain = typeof pack.get === 'function'
      ? pack.get({ plain: true })
      : pack;

    return {
      id: Number(plain.id),
      cash: Number(plain.cash || 0),
      oro: Number(plain.oro || 0),
      puntos: Number(plain.puntos || 0),
    };
  }

  clone(pack) {
    return pack ? { ...pack } : null;
  }

  async loadFromDatabase() {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      const rows = await RecargasPack.findAll({
        attributes: ['id', 'cash', 'oro', 'puntos'],
        order: [['id', 'ASC']],
        raw: true,
      });

      this.packsById.clear();

      for (const row of rows) {
        this.addOrUpdate(row);
      }

      this.loaded = true;
      this.loadedAt = new Date();
      console.log(`[RecargasPackCache] ${this.packsById.size} packs cargados en memoria`);
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

  addOrUpdate(pack) {
    const normalized = this.normalize(pack);

    if (!normalized.id) {
      return null;
    }

    this.packsById.set(normalized.id, normalized);
    return this.clone(normalized);
  }

  getById(id) {
    return this.clone(this.packsById.get(Number(id)) || null);
  }

  getAll() {
    return [...this.packsById.values()]
      .sort((a, b) => a.id - b.id)
      .map((pack) => this.clone(pack));
  }

  getStats() {
    return {
      packs: this.packsById.size,
      loaded: this.loaded,
      loadedAt: this.loadedAt,
    };
  }
}

const recargasPackCache = new RecargasPackCache();
export default recargasPackCache;
