import clanService from './clan.service.js';

const sendResult = (res, result) => {
  if (result?.success || result?.code) {
    return res.status(200).json(result);
  }

  return res.status(400).json(result);
};

const handleError = (res, label, error) => {
  console.error(label, error);
  return res.status(500).json({ error: 'Error interno del servidor' });
};

const getAllClans = async (req, res) => {
  try {
    const { user, token, search, page, limit } = req.body;
    const result = await clanService.getAllClans(user, token, search, page, limit, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al obtener clanes:', error);
  }
};

const getMyClan = async (req, res) => {
  try {
    const { user, token } = req.body;
    const result = await clanService.getMyClan(user, token, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al obtener mi clan:', error);
  }
};

const getClanMembers = async (req, res) => {
  try {
    const { user, token, clanId, search, page, limit } = req.body;
    const result = await clanService.getClanMembers(user, token, clanId, search, page, limit, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al obtener miembros del clan:', error);
  }
};

const getClanRequests = async (req, res) => {
  try {
    const { user, token, clanId, search, page, limit } = req.body;
    const result = await clanService.getClanRequests(user, token, clanId, search, page, limit, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al obtener solicitudes del clan:', error);
  }
};

const sendClanRequest = async (req, res) => {
  try {
    const { user, token, clanId } = req.body;
    const result = await clanService.sendClanRequest(user, token, clanId, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al enviar solicitud al clan:', error);
  }
};

const cancelClanRequest = async (req, res) => {
  try {
    const { user, token, clanId } = req.body;
    const result = await clanService.cancelClanRequest(user, token, clanId, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al cancelar solicitud al clan:', error);
  }
};

const createClan = async (req, res) => {
  try {
    const { user, token, clanName } = req.body;
    const result = await clanService.createClan(user, token, clanName, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al crear clan:', error);
  }
};

const resolveClanRequest = async (req, res) => {
  try {
    const { user, token, requestId, action } = req.body;
    const result = await clanService.resolveClanRequest(user, token, requestId, action, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al resolver solicitud del clan:', error);
  }
};

const deleteClanMember = async (req, res) => {
  try {
    const { user, token, clanId, memberId } = req.body;
    const result = await clanService.deleteClanMember(user, token, clanId, memberId, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al eliminar miembro del clan:', error);
  }
};

const leaveClan = async (req, res) => {
  try {
    const { user, token, clanId } = req.body;
    const result = await clanService.leaveClan(user, token, clanId, req);
    return sendResult(res, result);
  } catch (error) {
    return handleError(res, 'Error al salir del clan:', error);
  }
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
  deleteClanMember,
  leaveClan,
};
