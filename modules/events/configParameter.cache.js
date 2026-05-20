import ConfigParameters from '../../models/configParametersModel.js';

class ConfigParameterCache {
  constructor() {
    this.parameters = new Map(); // name -> parameter
    this.loaded = false;
    this.loadedAt = null;
    this.loadingPromise = null;
  }

  normalize(parameter) {
    const plain = typeof parameter.get === 'function'
      ? parameter.get({ plain: true })
      : parameter;

    return {
      name: String(plain.name || '').trim(),
      description: plain.description || '',
      value: plain.value,
      isparameter: Number(plain.isparameter ?? 0),
      tipo: Number(plain.tipo ?? 0),
      clase: Number(plain.clase ?? 2),
    };
  }

  clone(parameter) {
    return parameter ? { ...parameter } : null;
  }

  async loadFromDatabase() {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      const rows = await ConfigParameters.findAll({
        raw: true,
        order: [['name', 'ASC']],
      });

      this.parameters.clear();

      for (const row of rows) {
        this.addOrUpdate(row);
      }

      this.loaded = true;
      this.loadedAt = new Date();
      console.log(`[ConfigParameterCache] ${this.parameters.size} parametros cargados en memoria`);
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

  get(name) {
    return this.clone(this.parameters.get(String(name || '').trim()) || null);
  }

  getValue(name, fallback = null) {
    const parameter = this.get(name);
    return parameter ? parameter.value : fallback;
  }

  getNumber(name, fallback = 0) {
    const value = this.getValue(name, null);

    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? fallback : numberValue;
  }

  getJson(name, fallback = null) {
    const value = this.getValue(name, null);

    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  addOrUpdate(parameter) {
    const normalized = this.normalize(parameter);

    if (!normalized.name) {
      return null;
    }

    this.parameters.set(normalized.name, normalized);
    return this.clone(normalized);
  }

  remove(name) {
    this.parameters.delete(String(name || '').trim());
  }

  getAll() {
    return [...this.parameters.values()].map((parameter) => this.clone(parameter));
  }

  getParameters() {
    return this.getAll().filter((parameter) => Number(parameter.isparameter) === 1);
  }

  getStats() {
    return {
      parameters: this.parameters.size,
      loaded: this.loaded,
      loadedAt: this.loadedAt,
    };
  }
}

const configParameterCache = new ConfigParameterCache();
export default configParameterCache;
