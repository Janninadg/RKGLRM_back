import Cupon from '../../models/cuponesModel.js';

class CouponCache {
  constructor() {
    this.coupons = new Map(); // ticket -> coupon
    this.loaded = false;
    this.loadedAt = null;
  }

  normalize(coupon) {
    const plain = typeof coupon.get === 'function' ? coupon.get({ plain: true }) : coupon;

    return {
      id: plain.id,
      ticket: String(plain.ticket || '').trim(),
      type: Number(plain.type),
      id_prize: Number(plain.id_prize),
      name_prize: plain.name_prize,
      uri: plain.uri || '',
      limite: Number(plain.limite || 0),
      users: Number(plain.users || 0),
    };
  }

  async loadFromDatabase() {
    const rows = await Cupon.findAll({ raw: true });
    this.coupons.clear();

    for (const row of rows) {
      const coupon = this.normalize(row);
      if (coupon.ticket) {
        this.coupons.set(coupon.ticket, coupon);
      }
    }

    this.loaded = true;
    this.loadedAt = new Date();
    console.log(`[CouponCache] ${this.coupons.size} cupones cargados en memoria`);
  }

  get(ticket) {
    return this.coupons.get(String(ticket || '').trim()) || null;
  }

  canRedeemLocal(ticket) {
    const coupon = this.get(ticket);

    if (!coupon) {
      return {
        ok: false,
        success: false,
        code: '004',
        message: 'El cupón ingresado no existe',
      };
    }

    if (coupon.limite <= coupon.users) {
      return {
        ok: false,
        success: false,
        code: '002',
        message: 'El cupón ingresado ya expiró',
      };
    }

    return { ok: true, coupon };
  }

  addOrUpdate(coupon) {
    const normalized = this.normalize(coupon);

    if (!normalized.ticket) {
      return null;
    }

    this.coupons.set(normalized.ticket, normalized);
    return normalized;
  }

  remove(ticket) {
    this.coupons.delete(String(ticket || '').trim());
  }

  markRedeemed(ticket, usersFromDb = null) {
    const normalizedTicket = String(ticket || '').trim();
    const coupon = this.coupons.get(normalizedTicket);

    if (!coupon) {
      return null;
    }

    coupon.users = usersFromDb !== null ? Number(usersFromDb) : Number(coupon.users || 0) + 1;
    this.coupons.set(normalizedTicket, coupon);
    return coupon;
  }

  async syncCouponFromDatabase(ticket) {
    const normalizedTicket = String(ticket || '').trim();

    const row = await Cupon.findOne({
      where: { ticket: normalizedTicket },
      raw: true,
    });

    if (!row) {
      this.remove(normalizedTicket);
      return null;
    }

    return this.addOrUpdate(row);
  }

  getAll() {
    return [...this.coupons.values()];
  }
}

const couponCache = new CouponCache();
export default couponCache;
