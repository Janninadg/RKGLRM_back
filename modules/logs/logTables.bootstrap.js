import sequelize from '../../config/database.js';

const LOG_PERFORMANCE_INDEXES = [
  {
    table: 'temp_cupones',
    name: 'temp_cupones_ticket_fecha_idx',
    columns: ['`ticket`', '`fecha`'],
  },
  {
    table: 'logpanelgm',
    name: 'logpanelgm_date_idx',
    columns: ['`date`'],
  },
  {
    table: 'logpanelgm',
    name: 'logpanelgm_cupon_type_date_idx',
    columns: ['`cupon`', '`type`', '`date`'],
  },
  {
    table: 'logstreams',
    name: 'logstreams_date_idx',
    columns: ['`date`'],
  },
  {
    table: 'logstreams',
    name: 'logstreams_cupon_date_idx',
    columns: ['`cupon`', '`date`'],
  },
  {
    table: 'logrewardsusers',
    name: 'logrewardsusers_fecha_idx',
    columns: ['`fecha`'],
  },
  {
    table: 'logexchanges',
    name: 'logexchanges_date_idx',
    columns: ['`date`'],
  },
];

async function indexExists(table, indexName) {
  const [rows] = await sequelize.query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND INDEX_NAME = :indexName
      LIMIT 1
    `,
    {
      replacements: { table, indexName },
    }
  );

  return rows.length > 0;
}

async function ensureIndex({ table, name, columns }) {
  try {
    if (await indexExists(table, name)) return;

    await sequelize.query(
      `CREATE INDEX \`${name}\` ON \`${table}\` (${columns.join(', ')})`
    );

    console.log(`[LogTablesBootstrap] indice ${name} creado`);
  } catch (error) {
    console.error(`[LogTablesBootstrap] no se pudo crear el indice ${name}:`, error.message);
  }
}

export async function initLogTablesPerformance() {
  for (const index of LOG_PERFORMANCE_INDEXES) {
    await ensureIndex(index);
  }
}
