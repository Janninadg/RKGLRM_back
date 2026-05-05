import { Op } from 'sequelize';
import sequelize from '../../config/database.js';
import { validateUserSession } from '../../utils/utils.js';
import clanRepository from './clan.repository.js';

const getPagination = (page = 1, limit = 10) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.max(parseInt(limit, 10) || 10, 1);
  const offset = (pageNumber - 1) * pageSize;

  return { pageNumber, pageSize, offset };
};

const mapUsersByNickname = async (userIds, transaction) => {
  const cleanIds = [...new Set(userIds.map(String).filter(Boolean))];

  if (cleanIds.length === 0) {
    return new Map();
  }

  const users = await clanRepository.findUsersByIds(cleanIds, transaction);
  return new Map(users.map(u => [String(u.id), u.apodo]));
};

const withTransaction = async (handler) => {
  const t = await sequelize.transaction();

  try {
    const result = await handler(t);
    await t.commit();
    return result;
  } catch (error) {
    await t.rollback();
    console.log(error);
    throw error;
  }
};

const validateSessionOrReturn = async (user, token, transaction) => {
  return validateUserSession(user, token, transaction);
};

const getAllClans = async (user, token, search, page = 1, limit = 10, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const { pageNumber, pageSize, offset } = getPagination(page, limit);
    const where = {};

    if (search && search.trim() !== '') {
      where.name = { [Op.like]: `%${search.trim()}%` };
    }

    const { count, rows } = await clanRepository.findClansPaginated({
      where,
      offset,
      limit: pageSize,
      transaction: t,
    });

    const masterIds = [...new Set(rows.map(c => Number(c.masterid)).filter(Boolean))];
    const gameUsers = masterIds.length > 0
      ? await clanRepository.findUserGamesByIds(masterIds, t)
      : [];

    const gameUserMap = new Map(gameUsers.map(g => [Number(g.id), g.name]));
    const userIds = [...new Set(gameUsers.map(g => g.name).filter(Boolean))];
    const userMap = await mapUsersByNickname(userIds, t);

    return {
      success: true,
      code: '000',
      clans: rows.map(c => {
        const gameUserName = gameUserMap.get(Number(c.masterid));
        const apodo = userMap.get(String(gameUserName));

        return {
          id: c.id,
          name: c.name,
          memberCount: c.members,
          masterName: apodo || 'Desconocido',
        };
      }),
      pagination: {
        total: count,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  });
};

const getMyClan = async (user, token, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const userGame = await clanRepository.findUserGameByName(user, t, {
      attributes: ['id', 'name', 'clanid'],
    });

    if (!userGame) {
      return { success: false, code: '404', message: 'Usuario no encontrado.' };
    }

    let clan = null;

    if (userGame.clanid && Number(userGame.clanid) > 0) {
      const clanInfo = await clanRepository.findClanById(userGame.clanid, t, {
        attributes: ['id', 'name', 'masterid'],
      });

      if (clanInfo) {
        let masterName = null;
        let masterNickname = null;

        const masterUserGame = await clanRepository.findUserGameById(clanInfo.masterid, t, {
          attributes: ['id', 'name'],
        });

        if (masterUserGame) {
          masterName = masterUserGame.name;
          const userMap = await mapUsersByNickname([masterUserGame.name], t);
          masterNickname = userMap.get(String(masterUserGame.name));
        }

        clan = {
          id: clanInfo.id,
          name: clanInfo.name,
          isMaster: Number(clanInfo.masterid) === Number(userGame.id),
          masterName,
          masterNickname: masterNickname || masterName,
        };
      }
    }

    const pendingRequest = await clanRepository.findPendingRequestByUser(user, t);
    let pendingRequestInfo = null;

    if (pendingRequest) {
      const clanRequested = await clanRepository.findClanById(pendingRequest.clanid, t, {
        attributes: ['id', 'name'],
      });

      if (clanRequested) {
        pendingRequestInfo = {
          clanId: clanRequested.id,
          clanName: clanRequested.name,
        };
      }
    }

    return {
      success: true,
      code: '000',
      clan,
      pendingRequest: pendingRequestInfo,
    };
  });
};

const getClanMembers = async (user, token, clanId, search = '', page = 1, limit = 10, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const { pageNumber, pageSize, offset } = getPagination(page, limit);

    const { count, rows } = await clanRepository.findClanMembersPaginated({
      clanId,
      search,
      offset,
      limit: pageSize,
      transaction: t,
    });

    const clanInfo = await clanRepository.findClanById(clanId, t, {
      attributes: ['masterid'],
    });

    const userNames = rows.map(m => m.name).filter(Boolean);
    const apodoMap = await mapUsersByNickname(userNames, t);

    return {
      success: true,
      code: '000',
      members: rows.map(m => ({
        id: m.id,
        user: m.name,
        nickname: apodoMap.get(String(m.name)) || m.name,
        isMaster: Number(clanInfo?.masterid) === Number(m.id),
      })),
      pagination: {
        total: count,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  });
};

const sendClanRequest = async (user, token, clanId, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const userGame = await clanRepository.findUserGameByName(user, t, {
      attributes: ['id', 'clanid'],
    });

    if (!userGame) {
      return { success: false, code: '404', message: 'Usuario no encontrado.' };
    }

    if (Number(userGame.clanid) > 0) {
      return { success: false, code: '100', message: 'Ya perteneces a un clan.' };
    }

    const existingMaster = await clanRepository.findClanByMasterId(user, t);
    if (existingMaster) {
      return {
        success: false,
        code: '101',
        message: 'No puedes solicitar ingreso a otro clan porque eres master de un clan.',
      };
    }

    const clan = await clanRepository.findClanById(clanId, t, { attributes: ['id'] });
    if (!clan) {
      return { success: false, code: '103', message: 'El clan no existe.' };
    }

    const pendingRequest = await clanRepository.findPendingRequestByUser(user, t);

    if (pendingRequest) {
      if (String(pendingRequest.clanid) === String(clanId)) {
        return {
          success: false,
          code: '102',
          message: 'Ya tienes una solicitud pendiente para este clan.',
        };
      }

      await pendingRequest.destroy({ transaction: t });
    }

    await clanRepository.createClanRequest({ userid: String(user), clanid: clanId }, t);

    return {
      success: true,
      code: '000',
      message: pendingRequest
        ? 'Se reemplazó la solicitud anterior y se envió la nueva solicitud correctamente.'
        : 'Se envió la solicitud al clan correctamente.',
    };
  });
};

const cancelClanRequest = async (user, token, clanId, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const deleted = await clanRepository.deleteClanRequest({ userid: String(user), clanid: clanId }, t);

    if (!deleted) {
      return {
        success: false,
        code: '404',
        message: 'No existe una solicitud pendiente a ese clan.',
      };
    }

    return {
      success: true,
      code: '000',
      message: 'Solicitud cancelada correctamente.',
    };
  });
};

const createClan = async (user, token, clanName, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const cleanName = (clanName || '').trim();

    if (!cleanName || cleanName.length < 3 || cleanName.length > 12) {
      return {
        success: false,
        code: '100',
        message: 'El nombre del clan debe tener entre 3 y 12 caracteres.',
      };
    }

    const userGame = await clanRepository.findUserGameByName(user, t, {
      attributes: ['id', 'name', 'charname', 'clanid', 'country'],
    });

    if (!userGame) {
      return { success: false, code: '404', message: 'Usuario no encontrado.' };
    }

    if (Number(userGame.clanid) > 0) {
      return {
        success: false,
        code: '101',
        message: 'No puedes crear un clan porque ya perteneces a uno.',
      };
    }

    const existingMaster = await clanRepository.findClanByMasterId(userGame.id, t);
    if (existingMaster) {
      return { success: false, code: '102', message: 'Ya eres master de un clan.' };
    }

    const existingName = await clanRepository.findClanByName(cleanName, t);
    if (existingName) {
      return { success: false, code: '103', message: 'Ese nombre de clan ya existe.' };
    }

    const createdClan = await clanRepository.createClan({
      masterid: userGame.id,
      mastername: userGame.name,
      name: cleanName,
      point: 0,
      members: 1,
      rank: 0,
      createtime: new Date(),
      country: userGame.country || 9,
    }, t);

    await clanRepository.updateUserGame(userGame.id, { clanid: createdClan.id, clangrade: 1 }, t);

    await clanRepository.createClanLog({
      user,
      rol: 'master',
      target: cleanName,
      action: 'CREATE',
    }, t);

    return {
      success: true,
      code: '000',
      message: 'Clan creado correctamente.',
      clanId: createdClan.id,
    };
  });
};

const resolveClanRequest = async (user, token, requestId, action, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const request = await clanRepository.findRequestById(requestId, t);
    if (!request) {
      return { success: false, code: '404', message: 'La solicitud no existe.' };
    }

    const clan = await clanRepository.findClanById(request.clanid, t);
    const userMaster = await clanRepository.findUserGameByName(user, t);

    if (!clan || !userMaster || Number(clan.masterid) !== Number(userMaster.id)) {
      return {
        success: false,
        code: '401',
        message: 'No tienes permisos para resolver esta solicitud.',
      };
    }

    if (action !== 'accept' && action !== 'reject') {
      return { success: false, code: '400', message: 'Acción inválida.' };
    }

    const targetUser = await clanRepository.findUserGameByName(request.userid, t);
    if (!targetUser) {
      return { success: false, code: '405', message: 'El usuario de la solicitud ya no existe.' };
    }

    if (action === 'accept') {
      if (Number(targetUser.clanid) > 0) {
        await clanRepository.deleteClanRequest({ id: requestId }, t);
        return { success: false, code: '406', message: 'El usuario ya pertenece a un clan.' };
      }

      await clanRepository.updateUserGame(targetUser.id, { clanid: clan.id }, t);
      await clanRepository.updateClan(clan.id, { members: Number(clan.members || 0) + 1 }, t);

      await clanRepository.createClanLog({
        user: String(user),
        rol: 'master',
        target: String(targetUser.name),
        action: 'ACCEPT',
      }, t);

      await clanRepository.deleteClanRequest({ id: requestId }, t);

      return { success: true, code: '000', message: 'Solicitud aceptada correctamente.' };
    }

    await clanRepository.createClanLog({
      user: String(user),
      rol: 'master',
      target: String(targetUser.name),
      action: 'DECLINE',
    }, t);

    await clanRepository.deleteClanRequest({ id: requestId }, t);

    return { success: true, code: '000', message: 'Solicitud rechazada correctamente.' };
  });
};

const getClanRequests = async (user, token, clanId, search = '', page = 1, limit = 10, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const { pageNumber, pageSize, offset } = getPagination(page, limit);

    const requests = await clanRepository.findRequestsByClan(clanId, t);
    const userIds = requests.map(r => String(r.userid));

    const userGames = userIds.length > 0
      ? await clanRepository.findUserGamesByNames(userIds, t)
      : [];

    const userNames = userGames.map(u => u.name).filter(Boolean);
    const apodoMap = await mapUsersByNickname(userNames, t);
    const requestMap = new Map(requests.map(r => [String(r.userid), r.id]));

    let filtered = userGames.map(u => ({
      requestId: requestMap.get(String(u.name)) || null,
      user: u.name,
      nickname: apodoMap.get(String(u.name)) || u.name,
    }));

    if (search && search.trim() !== '') {
      const term = search.toLowerCase();
      filtered = filtered.filter(u =>
        (u.user || '').toLowerCase().includes(term) ||
        (u.nickname || '').toLowerCase().includes(term)
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + pageSize);

    return {
      success: true,
      code: '000',
      requests: paginated,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  });
};

const leaveClan = async (user, token, clanId, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const currentUser = await clanRepository.findUserGameByName(user, t, {
      lock: t.LOCK.UPDATE,
    });

    if (!currentUser) {
      return { success: false, code: '404', message: 'El usuario autenticado no existe.' };
    }

    const clan = await clanRepository.findClanById(clanId, t, {
      lock: t.LOCK.UPDATE,
    });

    if (!clan) {
      return { success: false, code: '405', message: 'El clan no existe.' };
    }

    if (Number(currentUser.clanid) !== Number(clan.id)) {
      return { success: false, code: '408', message: 'No perteneces a este clan.' };
    }

    if (Number(clan.masterid) === Number(currentUser.id)) {
      return { success: false, code: '409', message: 'El master no puede salirse del clan.' };
    }

    await clanRepository.updateUserGame(currentUser.id, { clanid: 0 }, t);
    await clanRepository.updateClan(clan.id, { members: Math.max(Number(clan.members || 1) - 1, 0) }, t);

    await clanRepository.createClanLog({
      user: String(currentUser.name),
      rol: 'member',
      target: String(clan.name || clan.id),
      action: 'LEAVE',
    }, t);

    return { success: true, code: '000', message: 'Saliste del clan correctamente.' };
  });
};

const deleteClanMember = async (user, token, clanId, memberId, req) => {
  return withTransaction(async (t) => {
    const invalidSession = await validateSessionOrReturn(user, token, t);
    if (invalidSession) return invalidSession;

    const currentUser = await clanRepository.findUserGameByName(user, t);
    if (!currentUser) {
      return { success: false, code: '404', message: 'El usuario autenticado no existe.' };
    }

    const clan = await clanRepository.findClanById(clanId, t);
    if (!clan) {
      return { success: false, code: '405', message: 'El clan no existe.' };
    }

    if (Number(clan.masterid) !== Number(currentUser.id)) {
      return {
        success: false,
        code: '401',
        message: 'No tienes permisos para eliminar miembros de este clan.',
      };
    }

    const targetUser = await clanRepository.findUserGameByName(memberId, t);
    if (!targetUser) {
      return { success: false, code: '406', message: 'El miembro no existe.' };
    }

    if (Number(targetUser.id) === Number(clan.masterid)) {
      return { success: false, code: '407', message: 'No puedes eliminar al master del clan.' };
    }

    if (Number(targetUser.clanid) !== Number(clan.id)) {
      return { success: false, code: '408', message: 'El usuario no pertenece a este clan.' };
    }

    await clanRepository.updateUserGame(targetUser.id, { clanid: 0 }, t);
    await clanRepository.updateClan(clan.id, { members: Math.max(Number(clan.members || 1) - 1, 0) }, t);

    await clanRepository.createClanLog({
      user: String(currentUser.name),
      rol: 'master',
      target: String(targetUser.name),
      action: 'DELETE',
    }, t);

    return { success: true, code: '000', message: 'Miembro eliminado correctamente del clan.' };
  });
};

export default {
  getAllClans,
  getMyClan,
  getClanMembers,
  getClanRequests,
  sendClanRequest,
  cancelClanRequest,
  createClan,
  resolveClanRequest,
  leaveClan,
  deleteClanMember,
};
