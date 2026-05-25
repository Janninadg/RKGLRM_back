import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, 'logTables.config.json');

class LogTablesCache {
  constructor() {
    this.tables = [];
    this.tablesByKey = new Map();
    this.loaded = false;
    this.loadedAt = null;
  }

  normalizeColumn(column) {
    const columnType = column.type || null;
    const isSpecialColumn = Boolean(columnType || column.action || column.computed);

    return {
      key: String(column.key),
      field: column.field ? String(column.field) : `_${String(column.key)}`,
      filter: column.filter === null ? null : (column.filter || (isSpecialColumn ? null : 'text')),
      source: column.source || null,
      type: columnType,
      action: column.action || null,
      computed: column.computed || null,
      sortable: column.sortable === undefined ? !isSpecialColumn : column.sortable !== false,
      width: column.width || null,
      align: column.align || null,
      options: [],
    };
  }

  normalizeTable(table) {
    return {
      key: String(table.key),
      label: String(table.label),
      visible: table.visible !== false,
      model: String(table.model),
      defaultSort: {
        field: table.defaultSort?.field || 'id',
        direction: String(table.defaultSort?.direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      },
      columns: (table.columns || []).map((column) => this.normalizeColumn(column)),
    };
  }

  async load() {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    this.tables = parsed.map((table) => this.normalizeTable(table));
    this.tablesByKey = new Map(this.tables.map((table) => [table.key, table]));
    this.loaded = true;
    this.loadedAt = new Date();
    console.log(`[LogTablesCache] ${this.tables.length} tablas de logs cargadas`);
  }

  async ensureLoaded() {
    if (!this.loaded) {
      await this.load();
    }
  }

  cloneTable(table) {
    return {
      ...table,
      defaultSort: { ...table.defaultSort },
      columns: table.columns.map((column) => ({ ...column, options: [...(column.options || [])] })),
    };
  }

  async getAll() {
    await this.ensureLoaded();
    return this.tables.map((table) => this.cloneTable(table));
  }

  async getByKey(key) {
    await this.ensureLoaded();
    const table = this.tablesByKey.get(String(key)) || this.tables[0] || null;
    return table ? this.cloneTable(table) : null;
  }
}

const logTablesCache = new LogTablesCache();
export default logTablesCache;
