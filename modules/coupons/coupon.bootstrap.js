import couponCache from './coupon.cache.js';
import tempCouponCache from './tempCoupon.cache.js';
import sequelize from '../../config/database.js';

const COUPON_PERFORMANCE_INDEXES = [
  {
    table: 'cupones',
    name: 'cupones_ticket_idx',
    columns: ['`ticket`'],
  },
  {
    table: 'temp_cupones',
    name: 'temp_cupones_user_ticket_idx',
    columns: ['`user`', '`ticket`'],
  },
  {
    table: 'temp_cupones',
    name: 'temp_cupones_ip_ticket_idx',
    columns: ['`ip`', '`ticket`'],
  },
  {
    table: 'trackingpacket',
    name: 'trackingpacket_user_packet_prefix_idx',
    columns: ['`user`', '`packet`(191)'],
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

    console.log(`[CouponBootstrap] indice ${name} creado`);
  } catch (error) {
    console.error(`[CouponBootstrap] no se pudo crear el indice ${name}:`, error.message);
  }
}

export async function ensureCouponPerformanceIndexes() {
  for (const index of COUPON_PERFORMANCE_INDEXES) {
    await ensureIndex(index);
  }
}

export async function bootstrapCouponCache() {
  await ensureCouponPerformanceIndexes();
  await couponCache.loadFromDatabase();
  await tempCouponCache.loadFromDatabase();
}

// Alias por si en algún archivo ya usaste este nombre.
export const initCouponCache = bootstrapCouponCache;
