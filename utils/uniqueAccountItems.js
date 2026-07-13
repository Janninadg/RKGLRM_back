import { Op } from 'sequelize';
import Marketplace from '../models/Trades/marketPlaceModel.js';
import TempUserItemInfo from '../models/Trades/tempUserItemInfoModel.js';
import PendingPresents from '../models/pendingPresentsModel.js';
import UserItemInfo from '../models/userItemInfoModel.js';

export const UNIQUE_ACCOUNT_ITEM_IDS = Object.freeze([8004, 8009]);
export const UNIQUE_ACCOUNT_MARKETPLACE_ACTIVE_STATES = Object.freeze([1, 3]);

export const isUniqueAccountItem = (itemId) => (
  UNIQUE_ACCOUNT_ITEM_IDS.includes(Number(itemId))
);

export const buildUniqueAccountItemReason = (itemName = 'este item', actionLabel = 'entregar') => (
  `No se puede ${actionLabel} ${itemName} porque el usuario ya tiene uno. Solo se permite uno por cuenta.`
);

export const buildUniqueAccountInventoryReason = (itemName = 'este item', actionLabel = 'entregar') => (
  `No se puede ${actionLabel} ${itemName} porque el usuario ya lo tiene en el inventario. Solo se permite uno por cuenta.`
);

export const buildUniqueAccountPendingReason = (itemName = 'este item', actionLabel = 'entregar') => (
  `No se puede ${actionLabel} ${itemName} porque el usuario ya lo tiene en regalos pendientes. Solo se permite uno por cuenta.`
);

export const buildUniqueAccountMarketplaceReason = (
  itemName = 'este item',
  marketplaceState = null,
  actionLabel = 'entregar'
) => {
  const location = Number(marketplaceState) === 3
    ? 'en un chat activo de marketplace'
    : 'publicado en marketplace';

  return `No se puede ${actionLabel} ${itemName} porque el usuario ya lo tiene ${location}. Solo se permite uno por cuenta.`;
};

export const checkUniqueAccountItemAvailability = async ({
  userGameId,
  itemId,
  itemName = 'este item',
  transaction,
  excludeMarketId = null,
  includeMarketplace = true,
  actionLabel = 'entregar',
}) => {
  const normalizedUserGameId = Number(userGameId);
  const normalizedItemId = Number(itemId);

  if (!isUniqueAccountItem(normalizedItemId)) {
    return { allowed: true, reason: null, source: null };
  }

  if (!Number.isFinite(normalizedUserGameId) || normalizedUserGameId <= 0) {
    return {
      allowed: false,
      reason: 'No se pudo validar si el usuario ya tiene este item unico.',
      source: 'user',
    };
  }

  const lockOption = transaction?.LOCK?.UPDATE
    ? { lock: transaction.LOCK.UPDATE }
    : {};

  const [inventoryItem, pendingItem] = await Promise.all([
    UserItemInfo.findOne({
      attributes: ['id'],
      where: {
        userid: normalizedUserGameId,
        itemid: normalizedItemId,
      },
      transaction,
      ...lockOption,
    }),
    PendingPresents.findOne({
      attributes: ['id'],
      where: {
        user_id: normalizedUserGameId,
        present_id: normalizedItemId,
      },
      transaction,
      ...lockOption,
    }),
  ]);

  if (inventoryItem) {
    return {
      allowed: false,
      reason: buildUniqueAccountInventoryReason(itemName, actionLabel),
      source: 'inventory',
    };
  }

  if (pendingItem) {
    return {
      allowed: false,
      reason: buildUniqueAccountPendingReason(itemName, actionLabel),
      source: 'pending',
    };
  }

  if (!includeMarketplace) {
    return { allowed: true, reason: null, source: null };
  }

  const tempItems = await TempUserItemInfo.findAll({
    attributes: ['id'],
    where: {
      userid: normalizedUserGameId,
      itemid: normalizedItemId,
    },
    raw: true,
    transaction,
    ...lockOption,
  });

  const tempItemIds = tempItems.map((item) => Number(item.id)).filter(Boolean);

  if (tempItemIds.length === 0) {
    return { allowed: true, reason: null, source: null };
  }

  const marketplaceWhere = {
    itemid: {
      [Op.in]: tempItemIds,
    },
    estado: {
      [Op.in]: UNIQUE_ACCOUNT_MARKETPLACE_ACTIVE_STATES,
    },
  };

  const normalizedExcludeMarketId = Number(excludeMarketId);
  if (Number.isFinite(normalizedExcludeMarketId) && normalizedExcludeMarketId > 0) {
    marketplaceWhere.id = {
      [Op.ne]: normalizedExcludeMarketId,
    };
  }

  const marketplaceItem = await Marketplace.findOne({
    attributes: ['id', 'estado'],
    where: marketplaceWhere,
    transaction,
    ...lockOption,
  });

  if (marketplaceItem) {
    return {
      allowed: false,
      reason: buildUniqueAccountMarketplaceReason(itemName, marketplaceItem.estado, actionLabel),
      source: 'marketplace',
      marketplace_id: marketplaceItem.id,
    };
  }

  return { allowed: true, reason: null, source: null };
};
