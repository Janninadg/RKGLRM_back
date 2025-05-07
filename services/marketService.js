
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
import ItemImage from '../models/itemImagesModel.js';
import ConfigParameters from '../models/configParametersModel.js';
import User from '../models/userModel.js';
import { enviarMensajeACliente, obtenerClientesActivos } from '../socket/socketServer.mjs';

class MarketService {

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
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para comprar items.' };
            }

            // const res = await this.socketSend(user);

            // if(!res.success && res.code==='999'){
            //     await t.rollback(); 
            //     return res;
            // }

            // if(res.success && Number(res.obj.reason)===0 && user === res.obj.user){
            //     await t.rollback(); 
            //     console.log("[Error] Intenta comprar un item mientras esta jugando.".red);
            //     return { success: false, code: '200', message: 'No puedes comprar en el mercado mientras estes en el juego. Cierra sesión en el launcher.' };
            // }
    
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

            // Obtener el apodo del usuario desde la tabla USER
            const userInfo = await User.findOne({
                where: { id: user },
                attributes: ['apodo'],
                transaction: t,
            });

            if (!userInfo) {
                await t.rollback();
                console.log('[Error] No se encontró el apodo del usuario'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'No se encontró el apodo del usuario',
                };
            }

            if (item.vendedor === userInfo.apodo) {
                await t.rollback();
                console.log('[Error] Está intentando autocomprar items'.red);
                return { success: false, code: '200', message: 'No puedes comprar tus propios items' };
            }

            if (item.estado === 0 || item.estado === 2){
                await t.rollback();
                console.log('[Error] El item ya no se encuentra disponible en la tienda'.red);
                return { success: false, code: '200', message: 'El item ya no se encuentra disponible. Actualiza la tienda.' };
            }

            const sellerInfo = await User.findOne({
                where: { apodo: item.vendedor },
                attributes: ['id'],
                transaction: t,
            });


            var uCoin;
            var sCoin;
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

                    sCoin = await Cash.findOne({
                        where: {id:sellerInfo.id},
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
                    sCoin = await UserGameInfo.findOne({
                        where: {name:sellerInfo.id},
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
                return { success: false, code: '200', message: 'No tienes suficiente '+texCoin+' para realizar esta compra' };
            }

            // Decrementar... :)

            if(item.medio_pago === 0) {
                uCoin.cash -= totalCost;
                await uCoin.save({ transaction: t });

                sCoin.cash += totalCost;
                await sCoin.save({ transaction: t });
            } else {
                uCoin.gold -= totalCost;
                await uCoin.save({ transaction: t });

                sCoin.gold += totalCost;
                await sCoin.save({ transaction: t });
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
                characterid: 0,
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
                origen:9,
                recompensa:itemUserSeller.itemid,
                tipo_recompensa: 0,
                fecha: new Date(), 
              }, { transaction:t });
    
            // Registrar la compra en sellsRecord
            await SellsRecord.create({
                id_market: idmarket,
                buyer: userInfo.apodo,
                date: new Date(),
            }, { transaction: t });

            // Eliminar item de temp useriteminfo:
    
            // await TempUserItemInfo.destroy({
            //     where: {
            //       marketid: idmarket
            //     },
            //     transaction: t // Asociar la transacción con esta operación
            // });

            // Actualizar estado a 0 (vendido)
            item.estado = 0;
            await item.save({ transaction: t });

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

    async returnItem(user,token,idmarket,retries = 1) {
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
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para comprar items.' };
            }

            // const res = await this.socketSend(user);

            // if(!res.success && res.code==='999'){
            //     await t.rollback(); 
            //     return res;
            // }

            // if(res.success && Number(res.obj.reason)===0 && user === res.obj.user){
            //     await t.rollback(); 
            //     console.log("[Error] Intenta solicitar devolución de un item mientras esta jugando.".red);
            //     return { success: false, code: '200', message: 'No puedes solicitar un retorno de item mientras estes en el juego. Cierra sesión en el launcher.' };
            // }
    
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

            // Obtener el apodo del usuario desde la tabla USER
            const userInfo = await User.findOne({
                where: { id: user },
                attributes: ['apodo'],
                transaction: t,
            });

            if (!userInfo) {
                await t.rollback();
                console.log('[Error] No se encontró el apodo del usuario'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'No se encontró el apodo del usuario',
                };
            }

            if (item.vendedor !== userInfo.apodo) {
                await t.rollback();
                console.log('[Error] Está intentando retornar item que no es de su propiedad'.red);
                return { success: false, code: '200', message: 'No puedes retornar un item que no te pertenece' };
            }

            if (item.estado === 0){
                await t.rollback();
                console.log('[Error] El item ya fue fue vendido'.red);
                return { success: false, code: '200', message: 'El item ya ha sido comprado por alguien. Actualiza la tienda.' };
            }

            if (item.estado === 2){
                await t.rollback();
                console.log('[Error] El item ha sido retornado anteriormente'.red);
                return { success: false, code: '200', message: 'El item no se encuentra disponible porque ya se retornó. Actualiza la tienda.' };
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
                console.log('[Error] No tiene slots disponibles en su inventario para el retorno'.red);
                return { success: false, code: '200', message: 'No tiene slots disponbiles en tu inventario para retornar este item' };
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
                characterid: 0,
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
                origen:14,
                recompensa:itemUserSeller.itemid,
                tipo_recompensa: 0,
                fecha: new Date(), 
              }, { transaction:t });

            // Eliminar item de temp useriteminfo:
    
            // await TempUserItemInfo.destroy({
            //     where: {
            //       marketid: idmarket
            //     },
            //     transaction: t // Asociar la transacción con esta operación
            // });

            // Actualizar estado a 0 (vendido)
            item.estado = 2;
            await item.save({ transaction: t });

            await t.commit();
            const itms = await this.getItems();
            console.log('[Success] Retono exitoso'.green);
            return { success: true, code: '000', message: `Se te ha retornado un(a) ${itemName} y será enviado a tu inventario`, _mp: itms._mp };
    
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


    async sellItem(user,token,id,price,currency) {
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
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para vender.' };
            }

            // const res = await this.socketSend(user);

            // if(!res.success && res.code==='999'){
            //     await t.rollback(); 
            //     return res;
            // }

            // if(res.success && Number(res.obj.reason)===0 && user === res.obj.user){
            //     await t.rollback(); 
            //     console.log("[Error] Intenta vender un item mientras esta jugando.".red);
            //     return { success: false, code: '200', message: 'No puedes vender en el mercado mientras estes en el juego. Cierra sesión en el launcher.' };
            // }

             // Buscar el item por ID en UserItemInfo con bloqueo
            const userItem = await UserItemInfo.findOne({
                where: { id: id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!userItem) {
                await t.rollback();
                console.log('[Error] El item no existe o ya lo has vendido'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'El item no existe o ya ha sido puesto a la venta',
                };
            }

            // Obtener el ID del usuario desde UserGameInfo
            const userGame = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                    name: user,
                },
                transaction: t,
            });

            if (!userGame) {
                await t.rollback();
                console.log('[Error] Usuario no encontrado'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'ID de Usuario no encontrado',
                };
            }

            // Verificar que el item realmente le pertenezca al usuario
            if (userItem.userid !== userGame.id) {
                await t.rollback();
                console.log('[Error] El item no pertenece al usuario'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Este item no te pertenece',
                };
            }

            // Aquí continuarías con el proceso de venta (registro en marketplace, moverlo a otra tabla, etc.)

            var uCoin;
            var coDis;
            var texCoin;

            // 4. Obtener comisión
            const commissionParam = await ConfigParameters.findOne({
                where: { name: 'comission_selling' },
                transaction: t,
            });

            const commissionPercentage = commissionParam ? parseFloat(commissionParam.value) : 0;
            const commissionAmount = price * commissionPercentage;

            // console.log(commissionParam.value);
            // console.log(price);
            // console.log(commissionAmount);

            switch (currency) {
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
    
            if (!uCoin || coDis < commissionAmount) {
                await t.rollback();
                console.log('[Error] No tiene cash u oro disponible para pagar la comisión de venta'.red);
                return { success: false, code: '200', message: 'No tienes suficiente '+texCoin+' para pagar la comisión de venta.' };
            }

            // Decrementar... :)

            if(currency=== 0) {
                uCoin.cash -= commissionAmount;
                await uCoin.save({ transaction: t });
            } else {
                uCoin.gold -= commissionAmount;
                await uCoin.save({ transaction: t });
            }

            // Obtener el apodo del usuario desde la tabla USER
            const userInfo = await User.findOne({
                where: { id: user },
                attributes: ['apodo'],
                transaction: t,
            });

            if (!userInfo) {
                await t.rollback();
                console.log('[Error] No se encontró el apodo del usuario'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'No se encontró el apodo del usuario',
                };
            }

            const nickname = userInfo.apodo;
         

            // 1. Insertar en TempUserItemInfo con el id del marketplace
            const temp = await TempUserItemInfo.create({
                userid: userItem.userid,
                characterid: userItem.userid, // Modifica si es necesario
                itemid: userItem.itemid,
                item_sn: userItem.item_sn || 8000,
                sn_type: 3, // O el valor que corresponda
                level: userItem.level || 1,
                limittime: userItem.limittime || 0,
                slot: userItem.slot || 1,
                exp: userItem.exp,
                // marketid: 0, // IMPORTANTE: asegúrate de que tu tabla temp tenga este campo
            }, { transaction: t });

            // 2. Insertar en la tabla marketplace
            const market = await Marketplace.create({
                itemid: temp.id,
                vendedor: nickname,
                precio: price,
                medio_pago: currency,
                fecha: new Date(), // Fecha actual
            }, { transaction: t });

            // 3. Eliminar el ítem original
            await UserItemInfo.destroy({
                where: { id: userItem.id },
                transaction: t
            });

            await t.commit(); // Confirmar la transacción
            console.log('[Success] Venta exitosa'.green);
            return { success: true, code: '000',message:'Vendiste tu item correctamente.'};
        } catch (error) {
            await t.rollback();
            console.error('Error al vender item:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async socketSend(user){
          try {
              const objectSend = {
                'user':user,
                'type':4,
              };

              /*PRUEBA*/
            //   console.log("[Object Send] ".green, objectSend);
            //   const objectReceived = {
            //     'user': user,
            //     'reason':1,
            //   }
            //   console.log("[Object Received] ".magenta, objectReceived);

            //   return {success:true, obj:objectReceived};
             /*END*/

              const activos = obtenerClientesActivos();
              // console.log("[Servidor] Clientes activos:", activos);
      
              let res;
      
              if (activos.length > 0) {
                  // enviarMensajeACliente(activos[0], mssg);
                  try {
                    // Espera la respuesta de la promesa
                    res = await enviarMensajeACliente(activos[0], objectSend);
                    // console.log("Respuesta recibida:", res);
                    // Aquí puedes utilizar la variable 'res' que contiene la respuesta
                    // return res; // O hacer lo que necesites con ella
                    if(res.code && res.code==='999'){
                        return res;
                    }
                  } catch (error) {
                    console.error("Error al enviar mensaje:", error);
                    return {
                      success: false,
                      code: '999',
                      message: 'El servidor no puede realizar la comprobación para el mercado. Contacta con el administrador.'
                    };
                    // Maneja el error o lanza una excepción
                  }
              } else {
                  console.log("!![Server] No hay clientes activos para enviar mensajes.".red);
                  // console.log("!![Server]".blue,' No se pudo enviar el mensaje porque no hay clientes activos.'.blue);
                  return {
                    success: false,
                    code: '999',
                    message: 'Servidor inactivo, no se puede realizar la comprobación para el mercado. Contacta con el administrador.'
                  };
              }
      
            const response = JSON.parse(res);
            console.log("[Object Received] ".magenta, response);
            return {success:true,obj:response};
          } catch (errorObj) {
            console.error("Error al enviar mensaje:", errorObj);
            // return errorObj;  // Devuelves el error estándar que tú mismo preparaste
            console.log("!![Server] El servidor no puede realizar la comprobación para el mercado.".red);
            if(errorObj.code && errorObj.code==='999'){
                return errorObj;
            } else{
                return {
                    success: false,
                    code: '999',
                    message: 'El servidor no puede realizar la comprobación para el mercado. Contacta con el administrador.'
                  };
            }

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
                return { success: false, code: '200', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
            }

            // 2. Buscar apodo (nickname)
            const userRecord = await User.findOne({
                attributes: ['apodo'],
                where: { id: user },
                transaction: t,
            });

            if (!userRecord) {
                await t.rollback();
                return { success: false, code: '201', message: 'Usuario no encontrado.' };
            }

            const nickname = userRecord.apodo;

            // 3. Buscar compras en SellsRecords
            const sellRecords = await SellsRecord.findAll({
                where: { buyer: nickname },
                order: [['date', 'DESC']],
                transaction: t,
            });


            const purchaseDetails = [];

            for (const record of sellRecords) {
            // 4. Buscar Marketplace por id_market
            const marketRecord = await Marketplace.findOne({
                where: { id: record.id_market },
                transaction: t,
            });

            if (!marketRecord) continue; // Saltar si no se encuentra

            // 5. Buscar TempUserItemInfo por itemid de Marketplace
            const tempUserItemInfo = await TempUserItemInfo.findOne({
                where: { id: marketRecord.itemid },
                transaction: t,
            });

            if (!tempUserItemInfo) continue;

            // 7. Buscar ItemInfo por itemid de TempUserItemInfo
            const itemInfo = await ItemInfo.findOne({
                where: { id: tempUserItemInfo.itemid },
                transaction: t,
            });

            if (!itemInfo) continue;

            // 8. Buscar imagen en ItemImages
            const itemImage = await ItemImage.findOne({
                where: { item: tempUserItemInfo.itemid },
                transaction: t,
            });

            purchaseDetails.push({
                name: itemInfo.name,
                image: itemImage ? itemImage.image : null,
                seller: marketRecord.vendedor,
                date: record.date,
                currency:marketRecord.medio_pago,
                price:marketRecord.precio,
            });
            }

            await t.commit(); // Confirmar la transacción
            return { success: false, code: '000', _ib:purchaseDetails };
        } catch (error) {
            await t.rollback();
            console.error('Error al obtener historial de compra:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async getHistorySells(user,token) {
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
                return { success: false, code: '200', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
            }

            // 2. Buscar apodo (nickname)
            const userRecord = await User.findOne({
                attributes: ['apodo'],
                where: { id: user },
                transaction: t,
            });

            if (!userRecord) {
                await t.rollback();
                return { success: false, code: '201', message: 'Usuario no encontrado.' };
            }

            const nickname = userRecord.apodo;

          // 3. Buscar en Marketplace ventas realizadas por el usuario
            const sales = await Marketplace.findAll({
                where: {
                vendedor: nickname,
                estado: 0, // Vendido
                },
                transaction: t,
            });
        
            const sellsDetails = [];

            for (const sale of sales) {
                // Buscar TempUserItemInfo
                const tempUserItemInfo = await TempUserItemInfo.findOne({
                  where: { id: sale.itemid },
                  transaction: t,
                });
          
                if (!tempUserItemInfo) continue;
          
                // Buscar ItemInfo
                const itemInfo = await ItemInfo.findOne({
                  where: { id: tempUserItemInfo.itemid },
                  transaction: t,
                });
          
                if (!itemInfo) continue;
          
                // Buscar imagen en ItemImage
                const itemImage = await ItemImage.findOne({
                  where: { item: tempUserItemInfo.itemid },
                  transaction: t,
                });
          
                // Buscar comprador y fecha en SellsRecord
                const sellRecord = await SellsRecord.findOne({
                  where: { id_market: sale.id },
                  transaction: t,
                });
          
                if (!sellRecord) continue;
          
                sellsDetails.push({
                  name: itemInfo.name,
                  image: itemImage ? itemImage.image : null,
                  buyer: sellRecord.buyer,
                  currency:sale.medio_pago,
                  price:sale.precio,
                  date: sellRecord.date,
                });
              }

            await t.commit(); // Confirmar la transacción
            return { success: false, code: '000', _is:sellsDetails };
        } catch (error) {
            await t.rollback();
            console.error('Error al obtener historial de ventas:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async getItems() {
        try {
            const items = await Marketplace.findAll({
                where:{
                    estado:1,
                },
                order: [['fecha', 'DESC']],
            });

            // Obtener todos los itemIds de Market
            const itemIds = items.map(item => item.itemid);

            // Obtener la info de item id en temp_useriteminfo y renombrar la columna itemid a item
            const itemGeneralInfo = await TempUserItemInfo.findAll({
                attributes: ['id','exp', 'item_sn','level','limittime','sn_type','itemid'],
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

              // Obtener imágenes
            const itemImages = await ItemImage.findAll({
                where: {
                    item: itemIds2
                }
            });

            const imageMap = itemImages.reduce((map, img) => {
                map[img.item] = img.image;
                return map;
            }, {});


            // // Combinar los resultados
            const mergedItemsFinal = mergedItems.map(item => {
                // Buscar la información de useriteminfo correspondiente al itemid
                // console.log(item)
                const ii = itemInfoMap[item.uii.itemid] || {};
                const imageUrl = imageMap[item.uii.itemid] || 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png';

                 // Calcular diferencia de horas
                const fechaMarketplace = new Date(item.fecha); // fecha de la base de datos
                const ahora = new Date(); // fecha actual
                const diferenciaMs = ahora - fechaMarketplace; // Diferencia en milisegundos
                const horasPasadas = diferenciaMs / (1000 * 60 * 60); // Convertir a horas

                const returnFlag = horasPasadas >= 24; // true si pasaron 24h o más, false si no

                // Fusionar la información del item original con la información adicional
                return {
                    ...item,
                    ii,
                    url: imageUrl, // Añade la propiedad .url
                    return: returnFlag, // Añade la nueva propiedad .return
                };
            });

            return { success: true, code: '000', _mp: mergedItemsFinal };
        } catch (error) {
          console.error('Error al obtener items de la tienda:', error);
          throw new Error('Error interno del servidor');
        }
    }

    async getParams() {
        try{

            // Obtener comisión
            const parameters = await ConfigParameters.findAll({
                where: {
                    name: {
                        [Op.in]: ['comission_selling', 'min_price_sell'] // aquí pones los name que quieras traer
                    }
                }
            });

            return { success: true, code: '000', psll: parameters };
        } catch (error) {
          console.error('Error al obtener items de la tienda:', error);
          throw new Error('Error interno del servidor');
        }
    }

}

export default new MarketService();