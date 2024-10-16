
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
import Marketplace from '../models/marketPlaceModel.js';
import UserItemInfo from '../models/userItemInfoModel.js';
import TempUserItemInfo from '../models/tempUserItemInfoModel.js';
import SellsRecord from '../models/sellsRecordModel.js';

class MarketService {

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

    async buyItems(user,token,idmarket,retries = 1) {
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
    
            // Bloquear market place
            const item = await Marketplace.findOne({
                where: { id: idmarket },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
    
            if (!item) {
                await t.rollback();
                console.log('[Error] El market id del item no existe'.red);
                return { success: false, code: '200', message: 'El item no existe' };
            }

            if (item.vendedor === user) {
                await t.rollback();
                console.log('[Error] Está intentando autocomprar items'.red);
                return { success: false, code: '200', message: 'No puedes comprar tus propios items' };
            }

            if (item.estado === 0 || item.estado === 2){
                await t.rollback();
                console.log('[Error] El item ya no se encuentra disponible en la tienda'.red);
                return { success: false, code: '200', message: 'El item ya no se encuentra disponible. Actualiza la tienda.' };
            }


            var uCoin;
            var coDis;
            var texCoin;

            switch (item.medio_pago) {
                case 0: //cash
                     // Verificar puntos de evento del usuario con bloqueo
                    uCoin = await Cash.findOne({
                        where: {id:user},
                        transaction: t,
                        lock: t.LOCK.UPDATE,
                    });

                    coDis = uCoin.cash;
                    texCoin='Cash';
                    break;
                case 1: //oro
                    uCoin = await UserGameInfo.findOne({
                        where: {name:user},
                        transaction: t,
                        lock: t.LOCK.UPDATE,
                    });
                    coDis = uCoin.gold;
                    texCoin='Oro';
                    break;
                default:
                    await t.rollback();
                    console.log('[Error] Medio de pago no disponible'.red);
                    return { success: false, code: '200', message: 'Medio de pago no disponible' };
                    break;
            }
    
            const totalCost = item.precio;
            if (!uCoin || coDis < totalCost) {
                await t.rollback();
                console.log('[Error] No tiene cash u oro disponible para realizar la compra'.red);
                return { success: false, code: '200', message: 'No tienes suficiente '+texCoin+' realizar esta compra' };
            }

            // Decrementar... :)

            if(item.medio_pago === 0) {
                uCoin.cash -= totalCost;
                await uCoin.save({ transaction: t });
            } else {
                uCoin.gold -= totalCost;
                await uCoin.save({ transaction: t });
            }

            // Verificar si tiene slots disponibles... 3 boxes 30 items
             // Obtener el ID de usuario desde UserGameInfo por su nombre
             const userGame = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
                },
                // transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGame) {
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[Error] Usuario no encontrado'.red);
                return { success: false, code: '200', message: 'ID de Usuario no encontrado' };
            }
            
            //Obtener el nro de slot mas cercano disponible
            // Obtener todos los slots distintos del usuario
            const distinctSlots = await UserItemInfo.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']],
                where: {
                userid: userGame.id,
                },
                raw: true,
                transaction: t,
            });

            // Mapear los resultados a un array de números
            const distinctSlotsArray = distinctSlots.map((item) => item.slot)
            var slotFree = null;

            //console.log(distinctSlotsArray);

            for (let i = 0; i <= 89; i++) {
                if (!distinctSlotsArray.includes(i)) {
                    slotFree = i;
                    break;
                }
            }
            //console.log(slotFree);
            //Si no hay, volver a enviar el mensaje de slot no disponible
            if(slotFree === null){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[Error] No tiene slots disponibles en su inventario'.red);
                return { success: false, code: '200', message: 'No tiene slots disponbiles en tu inventario para comprar este item' };
            }

            // Obtener info del item con item.itemid
            const itemUserSeller = await TempUserItemInfo.findOne({
                where: { id: item.itemid },
                transaction: t,
            });

            // Obtener nombre del item desde ItemInfo
            const itemInfo = await ItemInfo.findOne({
                where: { id: itemUserSeller.itemid },
                transaction: t,
            });
    
            let itemName = itemInfo ? itemInfo.name : item.itemid;
    
            // Añadir el item a useriteminfo :)
            const newItem = await UserItemInfo.create({
                userid: userGame.id,           // ID del usuario que te proporcionarán
                characterid: itemUserSeller.characterid,
                itemid: itemUserSeller.itemid,
                item_sn: itemUserSeller.item_sn,
                sn_type: itemUserSeller.sn_type,
                level: itemUserSeller.level,
                limittime: itemUserSeller.limittime,
                slot: slotFree,               // Slot que te proporcionarán
                exp: itemUserSeller.exp,
            }, {
                transaction: t, // Asociar la transacción con la inserción
            });

            await LogRewardsUser.create({  
                user:user,
                origen:8,
                recompensa:itemUserSeller.itemid,
                tipo_recompensa: 0,
                fecha: new Date(), 
              }, { transaction:t });
    
            // Registrar la compra en sellsRecord
            await SellsRecord.create({
                id_market: idmarket,
                buyer: user,
                date: new Date(),
            }, { transaction: t });

            // Eliminar item de temp useriteminfo:
    
            await TempUserItemInfo.destroy({
                where: {
                  id: item.itemid
                },
                transaction: t // Asociar la transacción con esta operación
            });

            await t.commit();
            const itms = await this.getItems();
            console.log('[Success] Compra exitosa'.green);
            return { success: true, code: '000', message: `Has comprado un(a) ${itemName} y será enviado a tu inventario`, _mp: itms._mp };
    
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
            const items = await Marketplace.findAll({
                where:{
                    estado:1,
                },
                order: [['id', 'ASC']],
            });

            // Obtener todos los itemIds de Market
            const itemIds = items.map(item => item.itemid);

            // Obtener la info de item id en temp_useriteminfo y renombrar la columna itemid a item
            const itemGeneralInfo = await TempUserItemInfo.findAll({
                where: {
                    id: itemIds
                },
            });

            // console.log(itemGeneralInfo);

            // Paso 3: Convertir el resultado de userItemsInfo a un diccionario para fácil acceso
            const userItemsInfoMap = itemGeneralInfo.reduce((map, userItem) => {
                map[userItem.id] = userItem;
                return map;
            }, {});

            // Paso 4: Fusionar la información en el arreglo original de items
            const mergedItems = items.map(item => {
                // Buscar la información de useriteminfo correspondiente al itemid
                const uii = userItemsInfoMap[item.itemid] || {};

                // Fusionar la información del item original con la información adicional
                return {
                    ...item.toJSON(), // Convierte la instancia de Sequelize a un objeto plano
                    uii, // Agrega la información de useriteminfo
                };
            });

            // Obtener todos los itemIds de Market
            const itemIds2 = mergedItems.map(item => item.uii.itemid);

            // Obtener los nombres de los items desde ItemInfo
            const itemInfos = await ItemInfo.findAll({
                where: {
                    id: itemIds2
                },
                // attributes: ['id', 'name']
            });

            // Crear un mapa para un acceso rápido a los nombres
            // const itemInfoMap = {};

            const itemInfoMap = itemInfos.reduce((map, itemInfo) => {
                map[itemInfo.id] = itemInfo;
                return map;
            }, {});


            // // Combinar los resultados
            const mergedItemsFinal = mergedItems.map(item => {
                // Buscar la información de useriteminfo correspondiente al itemid
                // console.log(item)
                const ii = itemInfoMap[item.uii.itemid] || {};

                // Fusionar la información del item original con la información adicional
                return {
                    ...item, // Convierte la instancia de Sequelize a un objeto plano
                    ii, // Agrega la información de useriteminfo
                };
            });

            return { success: true, code: '000', _mp: mergedItemsFinal };
        } catch (error) {
          console.error('Error al obtener items de la tienda:', error);
          throw new Error('Error interno del servidor');
        }
    }

}

export default new MarketService();