import EventTestUser from '../../models/eventTestUserModel.js';

class EventTestUserCache {
  constructor() {
    this.usersByEvent = new Map(); // event -> Set(user)
    this.loaded = false;
    this.loadedAt = null;
  }

  normalize(row) {
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;

    return {
      id: Number(plain.id),
      user: String(plain.user || '').trim(),
      event: Number(plain.event),
    };
  }

  getEventKey(event) {
    return Number(event);
  }

  async loadFromDatabase() {
    const rows = await EventTestUser.findAll({
      attributes: ['id', 'user', 'event'],
      raw: true,
      order: [
        ['event', 'ASC'],
        ['user', 'ASC'],
      ],
    });

    this.usersByEvent.clear();

    for (const row of rows) {
      this.addOrUpdate(row);
    }

    this.loaded = true;
    this.loadedAt = new Date();
    console.log(`[EventTestUserCache] ${rows.length} usuarios test cargados en memoria`);
  }

  addOrUpdate(row) {
    const normalized = this.normalize(row);

    if (!normalized.user || !normalized.event) {
      return null;
    }

    const eventKey = this.getEventKey(normalized.event);
    const users = this.usersByEvent.get(eventKey) || new Set();
    users.add(normalized.user);
    this.usersByEvent.set(eventKey, users);

    return { ...normalized };
  }

  remove(event, user) {
    const users = this.usersByEvent.get(this.getEventKey(event));

    if (!users) {
      return;
    }

    users.delete(String(user || '').trim());
  }

  has(event, user) {
    const users = this.usersByEvent.get(this.getEventKey(event));
    return Boolean(users?.has(String(user || '').trim()));
  }

  getStats() {
    let users = 0;

    for (const eventUsers of this.usersByEvent.values()) {
      users += eventUsers.size;
    }

    return {
      users,
      events: this.usersByEvent.size,
      loaded: this.loaded,
      loadedAt: this.loadedAt,
    };
  }
}

const eventTestUserCache = new EventTestUserCache();
export default eventTestUserCache;
