
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
import ItemVirtual from '../models/ItemVirtualModel.js';
import UserPoisons from '../models/userPoisonsModel.js';
import ItemImage from '../models/itemImagesModel.js';
import { setClassName } from '../utils/prizesUtils.js';

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
             const userPoints = await UserGameInfo.findOne({
                where: { name: user},
                transaction: t,
                lock: t.LOCK.UPDATE,
            });
    
            const totalCost = item.price * amount;
            if (!userPoints || userPoints.clanpoint < totalCost) {
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
    

            let itemName;
            let typeReward;

            switch (item.type) {
                case 0:
                      // Obtener nombre del item desde ItemInfo
                      const virtualItm = await ItemVirtual.findOne({
                        where: { id: item.itemid },
                        transaction: t,
                    });
            
                    itemName = virtualItm ? virtualItm.name : item.itemid;
                    typeReward=16;

                    // Añadir entradas a PendingPresents
                    const userPois = await UserPoisons.findOne({
                        where: { user: user,idpocion:item.itemid },
                        transaction: t,
                    });

                    const quantity = virtualItm.cantidad * amount;
                   
                    if (!userPois) {
                        // Crear si no existe
                        await UserPoisons.create({
                            user: user,
                            idpocion: item.itemid,
                            cantidad: quantity,
                        }, { transaction: t });
                    } else {
                        // Si existe, aumentar la cantidad
                        await userPois.update({
                        cantidad: userPois.cantidad + quantity,
                        }, { transaction: t });
                    }
            
                    
                    break;
                case 1:
                    typeReward=0;
                    // Obtener nombre del item desde ItemInfo
                      const itemReal = await ItemInfo.findOne({
                        where: { id: item.itemid },
                        transaction: t,
                    });
            
                    itemName = itemReal ? itemReal.name : item.itemid;

                    console.log(userPoints.id);
                    console.log('aqui ...');

                    // Agregar el premio a PendingPresents usando el ID de usuario obtenido
                    await PendingPresents.create(
                    {
                        present_id: item.itemid,
                        user_id: userPoints.id, // Usar el ID de usuario obtenido
                        added_time: new Date(),
                    },
                    {
                        transaction: t, // Asociar la transacción con esta operación
                    }
                    );

                    break;
                default:
                    // Obtener nombre del item desde ItemInfo
                    // const itemInfo = await ItemInfo.findOne({
                    //     where: { id: item.itemid },
                    //     transaction: t,
                    // });
            
                    // itemName = itemInfo ? itemInfo.name : item.itemid;
                    // typeReward=0;
            
                    // // Añadir entradas a PendingPresents
                    // const userGameInfo = await UserGameInfo.findOne({
                    //     where: { name: user },
                    //     transaction: t,
                    // });
            
                    // if (!userGameInfo) {
                    //     await t.rollback();
                    //     return { success: false, code: '200', message: 'Usuario no encontrado' };
                    // }
            
                    // const userId = userGameInfo.id;
                    // const presentId = item.itemid;
            
                    // const pendingPresentsData = [];
                    // for (let i = 0; i < amount; i++) {
                    //     pendingPresentsData.push({
                    //         present_id: presentId,
                    //         user_id: userId,
                    //         added_time: new Date(),
                    //     });
                    // }
                
                    // await PendingPresents.bulkCreate(pendingPresentsData, { transaction: t });
                    await t.rollback();
                    return { success: false, code: '200', message: 'No existe tipo de item' };
                    break;
            }
          
    
            // Añadir entradas en LogRewardsUser
            const logRewardsUserData = [];
            for (let i = 0; i < amount; i++) {
                logRewardsUserData.push({
                    user: user,
                    origen: 7,
                    recompensa: item.itemid,
                    tipo_recompensa: typeReward,
                    fecha: new Date(),
                });
            }
    
            await LogRewardsUser.bulkCreate(logRewardsUserData, { transaction: t });
    
            // Actualizar puntos de evento del usuario
            userPoints.clanpoint -= totalCost;
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
                itemid: item.itemid,
                quantity: amount,
                pointsspent: item.price * amount,
                fecha: new Date(),
            }, { transaction: t });
    
            await t.commit();
            const itms = await this.getItems();
            return { success: true, code: '000', message: `Has comprado ${amount} ${itemName} exitosamente`, _is: itms._is };
    
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

    async getHistoryPucharse(user, token) {
        const t = await sequelize.transaction();
        try {
            // Verificar token:
            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: { token: token, id: user },
                transaction: t,
            });
    
            if (!sessionToken) {
                await t.rollback();
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
            }
    
            const purchaseItems = await PurchaseLogs.findAll({
                where: { user },
                order: [['fecha', 'DESC']],
                transaction: t
            });
    
            const purchaseItemsWithDetails = [];
    
            for (const purchase of purchaseItems) {
                const storeItem = await ItemStore.findOne({
                    where: { id: purchase.idstore },
                    transaction: t
                });
    
                if (!storeItem) continue;
    
                let name = 'Item desconocido';
                let img = null;
    
                if (storeItem.type === 0) {
                    const virtualItem = await ItemVirtual.findOne({
                        where: { id: storeItem.itemid },
                        transaction: t
                    });
    
                    if (virtualItem) {
                        name = virtualItem.name;
                        img = virtualItem.img;
                    }
                } else {
                    const itemStoreReal = await ItemInfo.findOne({
                        where: { id: storeItem.itemid },
                        transaction: t
                    });

                    const itemStoreImg= await ItemImage.findOne({
                        where: { item: storeItem.itemid },
                        transaction: t
                    });

                       if (itemStoreReal && itemStoreImg) {
                        const fullName = itemStoreReal.name + setClassName(itemStoreReal.Class);
                        name = fullName;
                        img = itemStoreImg.image;
                    }
                }
    
                purchaseItemsWithDetails.push({
                    id: purchase.id,
                    idstore: purchase.idstore,
                    fecha: purchase.fecha,
                    item: {
                        name,
                        img,
                        type: storeItem.type,
                        price: storeItem.price
                    }
                });
            }
    
            await t.commit();
            return { success: true, code: '000', _ip: purchaseItemsWithDetails };
    
        } catch (error) {
            await t.rollback();
            console.error('Error al obtener historial de compra:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async getVirtualInventory(user,token) {
        const t = await sequelize.transaction();
      
        try {

             // Verificar token:
             const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: { token: token, id: user },
                transaction: t,
            });
    
            if (!sessionToken) {
                await t.rollback();
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
            }
            
          const userItems = await UserPoisons.findAll({
            where: { user },
            transaction: t
          });
      
          const inventory = [];
      
          for (const item of userItems) {
            const virtual = await ItemVirtual.findOne({
              where: { id: item.idpocion },
              transaction: t
            });
      
            if (!virtual) continue;
      
            const cantidadDisponible = Math.floor(item.cantidad / virtual.cantidad);
      
            inventory.push({
              id: item.idpocion,
              name: virtual.name,
              img: virtual.img,
              cantidadDisponible
            });
          }
      
          await t.commit();
          return { success: true, code: '000', iv: inventory };
        } catch (error) {
          await t.rollback();
          console.error('Error al obtener inventario virtual:', error);
          throw new Error('Error interno del servidor');
        }
      }
    

    async getItems() {
        try {
          const items = await ItemStore.findAll({
            where: { show: 1 },
            order: [['id', 'ASC']],
          });
      
          // Separar itemIds por tipo
          const itemIds = items.map(item => item.itemid);
          const virtualItemIds = items.filter(item => item.type === 0).map(item => item.itemid);
          const realItemIds = items.filter(item => item.type !== 0).map(item => item.itemid);
      
          // Obtener info de ItemInfo (para type !== 0)
          const itemInfos = await ItemInfo.findAll({
            where: { id: realItemIds },
            attributes: ['id', 'name','Class']
          });

          const itemImages = await ItemImage.findAll({
            where: { item: realItemIds },
            attributes: ['item', 'image']
          });
      
          // Obtener info de ItemVirtual (para type === 0)
          const virtualInfos = await ItemVirtual.findAll({
            where: { id: virtualItemIds },
            attributes: ['id', 'name', 'img']
          });
      
          // Mapas de referencia
          const itemInfoMap = {};
          itemInfos.forEach(info => {
            itemInfoMap[info.id] = { name: info.name, Class:info.Class };
          });

           const imagesInfo = {};
          itemImages.forEach(info => {
            imagesInfo[info.item] = { img: info.image };
          });
      
          const virtualInfoMap = {};
          virtualInfos.forEach(info => {
            virtualInfoMap[info.id] = { name: info.name, img: info.img };
          });
      
          // Combinar resultados
          const itemsWithName = items.map(item => {
            const itemData = item.toJSON();
      
            if (item.type === 0) {
              const info = virtualInfoMap[item.itemid];
              itemData.name = info?.name || 'Nombre no encontrado';
              itemData.img = info?.img || '';
            } else {
              const info = itemInfoMap[item.itemid];
              const infoImg = imagesInfo[item.itemid];
              const fullName = info ? info.name + setClassName(info.Class) : 'Nombre no encontrado';
              itemData.name = fullName;
              itemData.img = infoImg?.img || '';
            }
      
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