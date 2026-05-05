import couponCache from './coupon.cache.js';
import tempCouponCache from './tempCoupon.cache.js';

export async function bootstrapCouponCache() {
  await couponCache.loadFromDatabase();
  await tempCouponCache.loadFromDatabase();
}

// Alias por si en algún archivo ya usaste este nombre.
export const initCouponCache = bootstrapCouponCache;
