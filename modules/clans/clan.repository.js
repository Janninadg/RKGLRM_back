import { Op } from 'sequelize';
import User from '../../models/userModel.js';
import UserGameInfo from '../../models/userGameInfoModel.js';
import ClanInfo from '../../models/clanInfoModel.js';
import ClanLog from '../../models/clanLogModel.js';
import ClanRequest from '../../models/clanRequestModel.js';

const findClansPaginated = ({ where, offset, limit, transaction }) => {
  return ClanInfo.findAndCountAll({
    attributes: ['id', 'name', 'members', 'masterid'],
    where,
    order: [
      ['members', 'DESC'],
      ['name', 'ASC'],
      ['id', 'ASC'],
    ],
    offset,
    limit,
    transaction,
  });
};

const findUserGameByName = (name, transaction, options = {}) => {
  return UserGameInfo.findOne({
    where: { name },
    transaction,
    ...options,
  });
};

const findUserGameById = (id, transaction, options = {}) => {
  return UserGameInfo.findOne({
    where: { id },
    transaction,
    ...options,
  });
};

const findUserGamesByIds = (ids, transaction) => {
  return UserGameInfo.findAll({
    attributes: ['id', 'name'],
    where: { id: { [Op.in]: ids } },
    transaction,
  });
};

const findUserGamesByNames = (names, transaction) => {
  return UserGameInfo.findAll({
    attributes: ['id', 'name'],
    where: { name: { [Op.in]: names } },
    transaction,
  });
};

const findUsersByIds = (ids, transaction) => {
  return User.findAll({
    attributes: ['id', 'apodo'],
    where: { id: { [Op.in]: ids } },
    transaction,
  });
};

const findClanById = (id, transaction, options = {}) => {
  return ClanInfo.findOne({
    where: { id },
    transaction,
    ...options,
  });
};

const findClanByName = (name, transaction) => {
  return ClanInfo.findOne({
    where: { name },
    transaction,
  });
};

const findClanByMasterId = (masterid, transaction) => {
  return ClanInfo.findOne({
    where: { masterid },
    transaction,
  });
};

const findClanMembersPaginated = ({ clanId, search, offset, limit, transaction }) => {
  const where = { clanid: clanId };

  if (search && search.trim() !== '') {
    where.name = { [Op.like]: `%${search.trim()}%` };
  }

  return UserGameInfo.findAndCountAll({
    attributes: ['id', 'name', 'clanid'],
    where,
    offset,
    limit,
    order: [['name', 'ASC']],
    transaction,
  });
};

const findPendingRequestByUser = (userid, transaction) => {
  return ClanRequest.findOne({
    where: { userid: String(userid) },
    order: [['id', 'DESC']],
    transaction,
  });
};

const findPendingRequestByUserAndClan = (userid, clanid, transaction) => {
  return ClanRequest.findOne({
    where: { userid: String(userid), clanid },
    transaction,
  });
};

const findRequestById = (id, transaction) => {
  return ClanRequest.findOne({
    where: { id },
    transaction,
  });
};

const findRequestsByClan = (clanid, transaction) => {
  return ClanRequest.findAll({
    where: { clanid },
    order: [['id', 'DESC']],
    transaction,
  });
};

const createClanRequest = (data, transaction) => ClanRequest.create(data, { transaction });
const deleteClanRequest = (where, transaction) => ClanRequest.destroy({ where, transaction });
const createClan = (data, transaction) => ClanInfo.create(data, { transaction });
const updateClan = (id, data, transaction) => ClanInfo.update(data, { where: { id }, transaction });
const updateUserGame = (id, data, transaction) => UserGameInfo.update(data, { where: { id }, transaction });
const createClanLog = (data, transaction) => ClanLog.create(data, { transaction });

export default {
  findClansPaginated,
  findUserGameByName,
  findUserGameById,
  findUserGamesByIds,
  findUserGamesByNames,
  findUsersByIds,
  findClanById,
  findClanByName,
  findClanByMasterId,
  findClanMembersPaginated,
  findPendingRequestByUser,
  findPendingRequestByUserAndClan,
  findRequestById,
  findRequestsByClan,
  createClanRequest,
  deleteClanRequest,
  createClan,
  updateClan,
  updateUserGame,
  createClanLog,
};
