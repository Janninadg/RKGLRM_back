import TempCupon from '../../models/tempCupones.js';

class TempCouponCache {
  constructor() {
    this.userRedeems = new Set(); // `${user}:${ticket}`
    this.ipRedeemCount = new Map(); // `${ip}:${ticket}` -> count
    this.loaded = false;
    this.loadedAt = null;
  }

  buildUserKey(user, ticket) {
    return `${String(user || '').trim()}:${String(ticket || '').trim()}`;
  }

  buildIpKey(ip, ticket) {
    return `${String(ip || '').trim()}:${String(ticket || '').trim()}`;
  }

  normalize(row) {
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;

    return {
      id: plain.id,
      user: String(plain.user || '').trim(),
      ticket: String(plain.ticket || '').trim(),
      ip: String(plain.ip || '').trim(),
      fecha: plain.fecha || null,
    };
  }

  async loadFromDatabase() {
    const rows = await TempCupon.findAll({ raw: true });

    this.userRedeems.clear();
    this.ipRedeemCount.clear();

    for (const row of rows) {
      this.addRedeem(row);
    }

    this.loaded = true;
    this.loadedAt = new Date();
    console.log(`[TempCouponCache] ${this.userRedeems.size} redenciones cargadas en memoria`);
  }

  hasUserRedeemed(user, ticket) {
    return this.userRedeems.has(this.buildUserKey(user, ticket));
  }

  getIpRedeemCount(ip, ticket) {
    return this.ipRedeemCount.get(this.buildIpKey(ip, ticket)) || 0;
  }

  canRedeemLocal(user, ticket, ip) {
    if (this.hasUserRedeemed(user, ticket)) {
      return {
        ok: false,
        success: false,
        code: '001',
        message: 'Ya canjeaste este cupón anteriormente',
      };
    }

    if (this.getIpRedeemCount(ip, ticket) >= 3) {
      return {
        ok: false,
        success: false,
        code: '001',
        message: 'No puedes canjear este cupón más de 3 veces desde la misma IP',
      };
    }

    return { ok: true };
  }

  addRedeem(row) {
    const redeem = this.normalize(row);

    if (!redeem.user || !redeem.ticket) {
      return null;
    }

    this.userRedeems.add(this.buildUserKey(redeem.user, redeem.ticket));

    if (redeem.ip) {
      const ipKey = this.buildIpKey(redeem.ip, redeem.ticket);
      this.ipRedeemCount.set(ipKey, (this.ipRedeemCount.get(ipKey) || 0) + 1);
    }

    return redeem;
  }

  getStats() {
    return {
      userRedeems: this.userRedeems.size,
      ipTicketPairs: this.ipRedeemCount.size,
      loaded: this.loaded,
      loadedAt: this.loadedAt,
    };
  }
}

const tempCouponCache = new TempCouponCache();
export default tempCouponCache;
