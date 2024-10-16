
import { Sequelize,Op } from 'sequelize';
import sequelize from '../config/database.js';
import { verifyPacketAndBan } from '../utils/securityUtils.js';
import { encrypt,generateKey } from '../helpers/encryption.js';
import PanelGM from '../models/gmPanelModel.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import Banlist from '../models/banListModel.js';
import Cash from '../models/cashModel.js';
import TrackingPacket from '../models/trackingPacketModel.js';
import ItemInfo from '../models/itemInfoModel.js';
import Cupon from '../models/cuponesModel.js';
import InitialIpUser from '../models/ipUserModel.js';
import Streamer from '../models/streamersModel.js';
import LogStream from '../models/logStreamsModel.js';
import Linksgame from '../models/linksGameModel.js';
import Anuncio from '../models/anunciosModel.js';
import TokenSession from '../models/tokenSessionModel.js';
import EventPoint from '../models/eventPointsModel.js';
import ItemStore from '../models/itemStoreModel.js';
import PurchaseLogs from '../models/pucharseLogsModel.js';
import PendingPresents from '../models/pendingPresentsModel.js';
import LogRewardsUser from '../models/logRewardUserModel.js';

class StoreService {

    async getEventPoints(user,token) {
        const t = await sequelize.transaction(); // Iniciar una transacción
        
        try {

            // Verificar token:
            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: {
                token: token,
                id: user,
                },
                transaction: t, // Asociar la transacción con esta consulta
            });

            if(!sessionToken){
                await t.rollback(); // Revertir la transacción en caso de error
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
            }

            // Obtener todos los registros y filtrar en JavaScript
            // const allUserPoints = await EventPoint.findAll({
            //     transaction: t
            // });

            // Filtrar en JavaScript
            // const userPoints = allUserPoints.find(record => {
            //     const firstName = record.User.split(' ')[0];
            //     return firstName === user;
            // });

             // Verificar puntos de evento del usuario
            const userPoints = await EventPoint.findOne({
                where: sequelize.where(sequelize.fn('SUBSTRING_INDEX', sequelize.col('User'), ' ', 1), user),
                transaction: t,
            });

            // Revertir la transacción en caso de error
            if(!userPoints){
                // await t.rollback();
                return { success: true, code: '000', ep: 0 };
            }

            // const points = userPoints[0].Points;

            await t.commit(); // Confirmar la transacción
            return { success: true, code: '000', ep: userPoints.Points };

        } catch (error) {
            await t.rollback();
            console.error('Error al obtener puntos de evento:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async buyItems(user,token,idstore,amount,retries = 1) {
        const t = await sequelize.transaction(); // Iniciar una transacción
        try {
            // Verificar token
            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: { token: token, id: user },
                transaction: t,
            });
    
            if (!sessionToken) {
                await t.rollback();
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
            }
    
            // Verificar stock disponible con bloqueo
            const item = await ItemStore.findOne({
                where: { id: idstore },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
    
            if (!item) {
                await t.rollback();
                return { success: false, code: '200', message: 'Item no encontrado' };
            }

            if (item.show === 0){
                await t.rollback();
                return { success: false, code: '200', message: 'El item ya no se encuentra disponible. Actualiza la tienda.' };
            }
    
            if (item.stockLimit === 1 && item.stock < amount) {
                await t.rollback();
                return { success: false, code: '200', message: 'La cantidad solicitada no está disponible, actualiza la tienda por favor' };
            }

             // Verificar puntos de evento del usuario con bloqueo
             const userPoints = await EventPoint.findOne({
                where: sequelize.where(sequelize.fn('SUBSTRING_INDEX', sequelize.col('User'), ' ', 1), user),
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
    
            const totalCost = item.price * amount;
            if (!userPoints || userPoints.Points < totalCost) {
                await t.rollback();
                return { success: false, code: '200', message: 'No tienes suficientes puntos de evento para realizar esta compra' };
            }
    
            // Verificar si userLimit es 1
            if (item.userLimit === 1) {
                const userPurchases = await PurchaseLogs.sum('quantity', {
                    where: { user: user, idstore: idstore },
                    transaction: t,
                });
    
                if (userPurchases + amount > item.maxUsers) {
                    await t.rollback();
                    return { success: false, code: '200', message: 'La cantidad que escogiste excede el límite de compra de este item por usuario, selecciona otra cantidad' };
                }
    
                if (userPurchases > item.maxUsers) {
                    await t.rollback();
                    return { success: false, code: '200', message: 'Ya excediste el limite de compra de este item, no puedes comprarlo más' };
                }
            }
    
            // Obtener nombre del item desde ItemInfo
            const itemInfo = await ItemInfo.findOne({
                where: { id: item.itemid },
                transaction: t,
            });
    
            let itemName = itemInfo ? itemInfo.name : item.itemid;
    
            // Añadir entradas a PendingPresents
            const userGameInfo = await UserGameInfo.findOne({
                where: { name: user },
                transaction: t,
            });
    
            if (!userGameInfo) {
                await t.rollback();
                return { success: false, code: '200', message: 'Usuario no encontrado' };
            }
    
            const userId = userGameInfo.id;
            const presentId = item.itemid;
    
            const pendingPresentsData = [];
            for (let i = 0; i < amount; i++) {
                pendingPresentsData.push({
                    present_id: presentId,
                    user_id: userId,
                    added_time: new Date(),
                });
            }
        
            await PendingPresents.bulkCreate(pendingPresentsData, { transaction: t });
    
            // Añadir entradas en LogRewardsUser
            const logRewardsUserData = [];
            for (let i = 0; i < amount; i++) {
                logRewardsUserData.push({
                    user: user,
                    origen: 7,
                    recompensa: item.itemid,
                    tipo_recompensa: 0,
                    fecha: new Date(),
                });
            }
    
            await LogRewardsUser.bulkCreate(logRewardsUserData, { transaction: t });
    
            // Actualizar puntos de evento del usuario
            userPoints.Points -= totalCost;
            await userPoints.save({ transaction: t });
    
            // Actualizar stock
            if(item.stockLimit === 1){
                item.stock -= amount;
                await item.save({ transaction: t });
            }
    
            // Registrar la compra en PurchaseLogs
            await PurchaseLogs.create({
                user: user,
                idstore: idstore,
                quantity: amount,
                pointsspent: item.price * amount,
                fecha: new Date(),
            }, { transaction: t });
    
            await t.commit();
            const itms = await this.getItems();
            return { success: true, code: '000', message: `Has comprado ${amount} ${itemName} exitosamente`, ep: userPoints.Points, _is: itms._is };
    
        } catch (error) {
            await t.rollback();
            console.error('Error al comprar items:', error);
    
            if (error.original && error.original.code === 'ER_LOCK_WAIT_TIMEOUT' && retries > 0) {
                // Reintentar la transacción
                console.log('Reintentando transacción...');
                return await this.buyItems(user, token, idstore, amount, retries - 1);
            }
    
            throw new Error('Error interno del servidor');
        }
    }

    async getHistoryPucharse(user,token) {
        const t = await sequelize.transaction(); // Iniciar una transacción
        try {
            // Verificar token:
            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: {
                token: token,
                id: user,
                },
                transaction: t, // Asociar la transacción con esta consulta
            });

            if(!sessionToken){
                await t.rollback(); // Revertir la transacción en caso de error
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
            }

            const pucharseItems = await PurchaseLogs.findAll({
                where:{
                    user:user
                },
                order: [['id', 'ASC']],
            });

            // Obtener todos los idstore de los registros de compra
            const storeIds = pucharseItems.map(purchase => purchase.idstore);

            // Obtener los itemIds de ItemStore
            const itemStores = await ItemStore.findAll({
                where: {
                    id: storeIds
                },
                attributes: ['id', 'itemid'],
                transaction: t
            });

            // Crear un mapa para un acceso rápido a los itemIds
            const itemStoreMap = {};
            itemStores.forEach(store => {
                itemStoreMap[store.id] = store.itemid;
            });

            // Obtener los nombres de los items desde ItemInfo
            const itemIds = Object.values(itemStoreMap);
            const itemInfos = await ItemInfo.findAll({
                where: {
                    id: itemIds
                },
                attributes: ['id', 'name'],
                transaction: t
            });

            // Crear un mapa para un acceso rápido a los nombres
            const itemInfoMap = {};
            itemInfos.forEach(info => {
                itemInfoMap[info.id] = info.name;
            });

             // Combinar los resultados
            const purchaseItemsWithDetails = pucharseItems.map(purchase => {
                const purchaseData = purchase.toJSON();
                const itemid = itemStoreMap[purchase.idstore];
                purchaseData.itemid = itemid;
                purchaseData.name = itemInfoMap[itemid] || 'Nombre no encontrado';
                return purchaseData;
            });

            await t.commit(); // Confirmar la transacción
            return { success: false, code: '000', _ip:purchaseItemsWithDetails };
        } catch (error) {
            await t.rollback();
            console.error('Error al obtener historial de compra:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async getItems() {
        try {
            const items = await ItemStore.findAll({
                where:{
                    show:1,
                },
                order: [['id', 'ASC']],
            });

            // Obtener todos los itemIds de ItemStore
            const itemIds = items.map(item => item.itemid);

            // Obtener los nombres de los items desde ItemInfo
            const itemInfos = await ItemInfo.findAll({
                where: {
                    id: itemIds
                },
                attributes: ['id', 'name']
            });

            // Crear un mapa para un acceso rápido a los nombres
            const itemInfoMap = {};
            itemInfos.forEach(info => {
                itemInfoMap[info.id] = info.name;
            });

            // Combinar los resultados
            const itemsWithName = items.map(item => {
                const itemData = item.toJSON();
                itemData.name = itemInfoMap[item.itemid] || 'Nombre no encontrado';
                return itemData;
            });

            return { success: true, code: '000', _is: itemsWithName };
        } catch (error) {
          console.error('Error al obtener items de la tienda:', error);
          throw new Error('Error interno del servidor');
        }
    }

}

export default new StoreService();