
import { Sequelize,Op } from 'sequelize';
import sequelize from '../config/database.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import Cash from '../models/cashModel.js';
import ItemInfo from '../models/itemInfoModel.js';
import TokenSession from '../models/tokenSessionModel.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import Marketplace from '../models/Trades/marketPlaceModel.js';
import UserItemInfo from '../models/userItemInfoModel.js';
import TempUserItemInfo from '../models/Trades/tempUserItemInfoModel.js';
import SellsRecord from '../models/Trades/sellsRecordModel.js';
import ItemImage from '../models/itemImagesModel.js';
import ConfigParameters from '../models/configParametersModel.js';
import User from '../models/userModel.js';
//import { enviarMensajeACliente, obtenerClientesActivos } from '../socket/socketServer.mjs';
import CharacterInfo from '../models/characterInfo.js';
import { setClassName, setTypeName } from '../utils/prizesUtils.js';
import PaymentMethods from '../models/Trades/paymentMethodsModel.js';
import publicDataCache, {
  PUBLIC_CACHE_KEYS,
  PUBLIC_CACHE_TTL,
} from '../modules/public/publicData.cache.js';
import UserCredits from '../models/Trades/userCreditsModel.js';
import UserInternalHolds from '../models/Trades/userHoldsModel.js';
import TradeChats from '../models/Trades/tradeChatsModel.js';
import TradeMessage from '../models/Trades/tradeMessagesModel.js';
import { enviarMensajeAUsuario } from '../socket/chatSocketServer.mjs';
import TradeActions from '../models/Trades/tradeActionsModel.js';
import TradeRatings from '../models/Trades/tradeRatingsModel.js';
import PendingPresents from '../models/pendingPresentsModel.js';
import MarketBanned from '../models/MarketBannedModel.js';
import UsersPanel from '../models/usersPanelModel.js';
import LogPanelGM from '../models/logPanelGMModel.js';

class MarketService {

    async buyItems(apodo,token,idmarket,chatid,retries = 1, transaction) {
        const t = await sequelize.transaction(); // Iniciar una transacción
        try {

            const user = (await User.findOne({where:{ apodo: apodo}}))['id'];

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
                transaction,
                lock: transaction.LOCK.UPDATE,
            });
    
            if (!item) {
                console.log('[Error] El market id del item no existe'.red);
                return { success: false, code: '200', message: 'El item no existe' };
            }

            if (item.vendedor === apodo) {
                console.log('[Error] Está intentando autocomprar items'.red);
                return { success: false, code: '200', message: 'No puedes comprar tus propios items' };
            }

            // Item estado 3 not porque se valida con el chat... Solo validar cuando init chat

            if (item.estado === 0 || item.estado === 2){
                console.log('[Error] El item ya no se encuentra disponible en la tienda'.red);
                return { success: false, code: '200', message: 'El item ya no se encuentra disponible. Actualiza la tienda.' };
            }

            const sellerInfo = await User.findOne({
                where: { apodo: item.vendedor },
                attributes: ['id'],
                transaction,
            });


            var sCoin;
            // Obtener el ID del usuario desde UserGameInfo usando su name
             const userGame = await UserGameInfo.findOne({
                attributes: ['id','bag'],
                where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
                },
                // transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGame) {
                console.log('[Error] Usuario no encontrado'.red);
                return { success: false, code: '200', message: 'ID de Usuario no encontrado' };
            }

            const medioPago = await PaymentMethods.findOne({
                where: {id: item.medio_pago},
                transaction
            })

            if(medioPago.type == 'INTERNAL'){
                 switch (item.medio_pago) {
                    case 1: //cash 
                        sCoin = await Cash.findOne({
                            where: {id:sellerInfo.id},
                            transaction,
                            lock: transaction.LOCK.UPDATE,
                        });
                    case 2: // puntos

                        sCoin = await UserGameInfo.findOne({
                            where: {name:sellerInfo.id},
                            transaction,
                            lock: transaction.LOCK.UPDATE,
                        });

                        break;
                    default:
                        console.log('[ERROR] Payment method: Not exists this internal payment'.red);
                        return { success: false, code: '200', message: 'Método de pago interno no existe' };
                }

            }
      
            // Verificar si tiene slots disponibles... 3 boxes 30 items

            //Obtener el nro de slot mas cercano disponible
            // Obtener todos los slots distintos del usuario
            const distinctSlots = await UserItemInfo.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']],
                where: {
                userid: userGame.id,
                characterid:0,
                },
                raw: true,
                transaction,
            });

            // Mapear los resultados a un array de números
            const distinctSlotsArray = distinctSlots.map((item) => Number(item.slot))
            var slotFree = null;

            // Determinar el rango según la cantidad de bags (1→30, 2→60, 3→90)
            const bagCount = userGame.bag;                          // 1, 2 o 3
            const maxSlotIndex = bagCount * 30 - 1;                  // 0–29, 0–59 ó 0–89

            console.log("BagCount:", bagCount, "maxSlotIndex:", maxSlotIndex, "total slots:", distinctSlotsArray.length);

            for (let i = 0; i <= maxSlotIndex; i++) {
                if (!distinctSlotsArray.includes(i)) {
                    console.log(i)
                    slotFree = i;
                    break;
                }
            }

            //Si no hay, volver a enviar el mensaje de slot no disponible
            if(slotFree === null){
                console.log('[Error] No tiene slots disponibles en su inventario'.red);
                return { success: false, code: '201', message: 'No tiene slots disponbiles en tu inventario para comprar este item' };
            }

            // 4. Verificar si el usuario tiene créditos disponibles
            const userCredits = await UserCredits.findOne({
                where: { user: sellerInfo.id },
                transaction,
                lock: transaction.LOCK.UPDATE, // Evita race conditions
            });

            // !userCredits || (userItem.level >= 27 && userCredits.credits <= 1)||
            if ( !userCredits || userCredits.credits <= 0) {
                // await transaction.rollback();
                console.log('[Error] No tiene créditos suficientes para publicar en trades'.red);
                return {
                    success: false,
                    code: '202',
                    message: 'No tienes créditos disponibles para publicar tu item en trades.',
                };
            }
            var bfCr = userCredits.credits;
            userCredits.credits -= 1;
            await userCredits.save({ transaction });

             var afCred = userCredits.credits;

            await LogRewardsUser.create({  
                user:sellerInfo.id,
                origen:22,
                recompensa: -1,
                tipo_recompensa: 21,
                last_pr: bfCr,
                curr_pr: afCred,
                fecha: new Date(), 
            }, { transaction });

            if(medioPago.type == 'INTERNAL'){
                const totalCost = item.precio;
                var typeCr = 0;
                var bfCr = 0;
                var aftCr = 0;
                if(item.medio_pago === 1) {
                    typeCr = 2;
                    bfCr = sCoin.cash;
                    sCoin.cash += totalCost;
                    aftCr = sCoin.cash;
                    await sCoin.save({ transaction });
                } else if(item.medio_pago === 2){
                    typeCr = 13;
                     bfCr = sCoin.clanpoint;
                    sCoin.clanpoint += totalCost;
                    aftCr = sCoin.clanpoint;
                    await sCoin.save({ transaction });
                }

                  await UserInternalHolds.create({
                    user,
                    trade_id: idmarket,
                    chat_id: chatid,
                    method_id: item.medio_pago,
                    amount: item.precio,
                    status: 'RELEASED',
                    created_at: new Date()
                }, { transaction: t });

                await LogRewardsUser.create({  
                    user:user,
                    origen:18,
                    recompensa:item.precio,
                    tipo_recompensa: typeCr,
                    last_pr: bfCr,
                    curr_pr: aftCr,
                    fecha: new Date(), 
                }, { transaction});
            }

            // Obtener info del item con item.itemid
            const itemUserSeller = await TempUserItemInfo.findOne({
                where: { id: item.itemid },
                transaction,
            });

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
                transaction, // Asociar la transacción con la inserción
            });

            await LogRewardsUser.create({  
                user:user,
                origen:9,
                recompensa:itemUserSeller.itemid,
                tipo_recompensa: 0,
                fecha: new Date(), 
              }, { transaction});
    
            // Registrar la compra en sellsRecord
            await SellsRecord.create({
                id_market: idmarket,
                buyer: apodo,
                date: new Date(),
            }, { transaction});

            // Actualizar estado a 0 (vendido)
            item.estado = 0;
            await item.save({ transaction });

            // await transaction.commit();
            console.log('[Success] Liberación y registro de item a comprador exitoso'.green);
            return { success: true, code: '000' };
    
        } catch (error) {
            console.error('Error al comprar items:', error);
    
            if (error.original && error.original.code === 'ER_LOCK_WAIT_TIMEOUT' && retries > 0) {
                // Reintentar la transacción
                console.log('Reintentando transacción...');
                return await this.buyItems(apodo, token, idmarket, retries - 1, transaction);
            }
            return { success: false, code: '200', message: 'Error interno del servidor'};
            // throw new Error('Error interno del servidor');
        }
    }

    async returnItem(apodo,token,idmarket,retries = 1,transaction,byCancel = false) {
        const t = transaction; // Iniciar una transacción
        try {

            // return { success: false, code: '999', message: 'Not available' };

            // Verificar token
            // const sessionToken = await TokenSession.findOne({
            //     attributes: ['token'],
            //     where: { token: token, id: user },
            //     transaction: t,
            // });
    
            // if (!sessionToken) {
            //     await t.rollback();
            //     return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para comprar items.' };
            // }

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
                where: { apodo },
                transaction: t,
            });

            const user = userInfo.id;

            if (!userInfo) {
                await t.rollback();
                console.log('[Error] No se encontró el apodo del usuario'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'No se encontró el apodo del usuario',
                };
            }

            if (item.vendedor !== apodo) {
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

            if(!byCancel){
                if (item.estado === 3){
                    await t.rollback();
                    console.log('[Error] El item esta siendo tradeado'.red);
                    return { success: false, code: '200', message: 'El item no se encuentra disponible porque hay un chat abierto. Actualiza la tienda.' };
                }
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
                characterid:0,
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
                return { success: false, code: '201', message: 'No tiene slots disponbiles en tu inventario para retornar este item' };
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

            // const itms = await this.getItems();
            console.log('[Success] Retono exitoso'.green);
            return { success: true, code: '000'};
    
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

     /**
   * submitRating
   * @param {Object} opts { user, auth, chat_id, rating, review, user_reviewed, retries = 1 }
   */
    async submitRating(opts = {}) {
        const { user, token, chat_id, rating, review = null, user_reviewed } = opts;
        const t = await sequelize.transaction();
        try {
        //   return { success: false, code: "200", message: "Suspendido temporalmente" };
            // 2) Buscar rater en UserGameInfo (recibiste 'user' como nombre del juego)
            const raterGame = await UserGameInfo.findOne({
                where: { name: user },
                transaction: t,
            });

            if (!raterGame) {
                await t.rollback();
                return { success: false, code: '200', message: 'Usuario (game name) no encontrado' };
            }
            const raterGameId = raterGame.id;

            // 3) Buscar la fila User del rater (si necesitas apodo, etc.)
            // Intentamos localizar un User por varios campos (adapta si tu modelo usa otro)
            const raterApodo = (await User.findOne({ where: { id: user}, transaction: t })).apodo;
        
            // No crítico: si no se encuentra, continuamos usando raterGameId pero intentamos validar token abajo

            // 4) Verificar token de sesión (intenta con id si tenemos, sino con token sólo)

             // Verificar token
            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: { token: token, id: user },
                transaction: t,
            });
    
            if (!sessionToken) {
                await t.rollback();
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para calificar a un usuario.' };
            }

            // 5) Buscar usuario que se va a calificar (user_reviewed viene como apodo del seller)
            const reviewedUser = await User.findOne({
                where: { apodo: user_reviewed },
                transaction: t,
            });
            if (!reviewedUser) {
                await t.rollback();
                return { success: false, code: '200', message: 'Usuario a calificar no encontrado' };
            }

            // 6) Buscar UserGameInfo del usuario calificado (para obtener su usergame id)
            // Intentamos por user id primero (si tu esquema tiene referencia).
            // si UserGameInfo tiene columna userid que apunta a User.id:
            const reviewedGame = await UserGameInfo.findOne({
                where: { name: reviewedUser.id },
                transaction: t,
            });

            if (!reviewedGame) {
                await t.rollback();
                return { success: false, code: '200', message: 'Información de juego del usuario calificado no encontrada' };
            }

            // 7) Buscar trade/chat para validar que el usuario calificado participa en él
            const chat = await TradeChats.findOne({
                where: { id: chat_id },
                transaction: t,
            });

            if (!chat) {
                await t.rollback();
                return { success: false, code: '200', message: 'Chat/trade no encontrado' };
            }

            const isSellerRatingBuyer = 
                raterApodo === chat.seller && reviewedUser.apodo === chat.buyer;

            const isBuyerRatingSeller = 
                raterApodo === chat.buyer && reviewedUser.apodo === chat.seller;

            if (!isSellerRatingBuyer && !isBuyerRatingSeller) {
                await t.rollback();
                return { success: false, code: '200', message: 'No tienes autorización de calificar al usuario por este trade.' };
            }

            // 8) Determinar rol que se está calificando (BUYER o SELLER)
            let roleReviewed = null;
            if (String(reviewedUser.apodo) === String(chat.seller)) {
                roleReviewed = 'SELLER';
            } else if (String(reviewedUser.apodo) === String(chat.buyer)) {
                roleReviewed = 'BUYER';
            } else {
                await t.rollback();
                return { success: false, code: '200', message: 'El usuario calificado no participa en este chat' };
            }

            // 9) Evitar calificaciones duplicadas por el mismo rater al mismo role
            // Asumimos que TradeRatings tiene campos: rater (int usergame id), reviewed (int usergame id), role_reviewed
            const existing = await TradeRatings.findOne({
                where: {
                    rater: raterGameId,
                    target: reviewedGame.id,
                    role: roleReviewed,
                },
                transaction: t,
            });

            if (existing) {
                await t.rollback();
                return { success: false, code: '200', message: 'Ya has calificado previamente a este usuario en este rol' };
            }

            // 10) Guardar la calificación
            const newRating = await TradeRatings.create({
                rater: raterGameId,
                rater_name: raterApodo,
                target: reviewedGame.id,
                target_name: reviewedUser.apodo,
                role: roleReviewed,
                rating: Number(rating),
                comment: review,
                created_at: new Date(),
            }, { transaction: t });

            await t.commit();
            return { success: true, code: '000', message: 'Se ha guardado tu calificación' };

        } catch (err) {
            await t.rollback();
            console.error('Error en TradeService.submitRating:', err);
            return { success: false, code: '999', message: 'Error interno al registrar calificación' };
        }
    }

    async cancelChatFromPanel(payload = {}) {
        const {
            chat_id,
            user,
            action,
            token,
            panelUser = user,
            skipReturnPoints = false
        } = payload;

        const t = await sequelize.transaction();

        try {
            if (!['CANCEL_CHAT_RETURN', 'CANCEL_CHAT_REPOST'].includes(action)) {
                await t.rollback();
                return { success: false, code: '200', message: 'Accion de cancelacion no valida.' };
            }

            const sessionToken = await TokenSession.findOne({
                attributes: ['token'],
                where: {
                    token,
                    id: panelUser,
                },
                transaction: t,
            });

            if (!sessionToken) {
                await t.rollback();
                return {
                    success: false,
                    code: '002',
                    message: 'Token invalido o tienes una sesion iniciada en otro navegador...'
                };
            }

            const existGM = await UsersPanel.findOne({
                attributes: ['id'],
                where: {
                    user,
                    [Op.or]: [{ type: 0 }, { type: 9 }, { type: 4 }],
                },
                transaction: t,
            });

            if (!existGM) {
                await t.rollback();
                return {
                    success: false,
                    code: '200',
                    message: 'Usted no puede cancelar chats porque ya no es GM.'
                };
            }

            const chat = await TradeChats.findOne({
                where: { id: chat_id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!chat) {
                await t.rollback();
                return { success: false, code: '200', message: 'Chat no encontrado.' };
            }

            const allActions = await TradeActions.findAll({
                where: { chat_id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            const closedActions = ['END_CHAT', 'CANCEL_CHAT_RETURN', 'CANCEL_CHAT_REPOST'];
            const alreadyClosed = allActions.some((item) => closedActions.includes(item.action));

            if (alreadyClosed || chat.status === 'CANCELLED' || chat.status === 'COMPLETED') {
                await t.rollback();
                return { success: false, code: '200', message: 'El chat ya esta finalizado o cancelado.' };
            }

            const releasedChat = allActions.some((item) => item.action === 'RELEASE_ITEM');

            if (releasedChat) {
                await t.rollback();
                return { success: false, code: '200', message: 'El chat no puede ser cancelado porque ya se libero el item.' };
            }

            const paymentMeth = await PaymentMethods.findOne({
                where: { id: chat.payment_method_id },
                transaction: t,
            });

            if (!paymentMeth) {
                await t.rollback();
                return { success: false, code: '200', message: 'Metodo de pago no encontrado.' };
            }

            if (paymentMeth.type === 'EXTERNAL') {
                const confirmed = allActions.some((item) => item.action === 'CONFIRM_PAYMENT');

                if (confirmed) {
                    await TradeMessage.create({
                        chat_id: chat.id,
                        sender: null,
                        message: 'El chat ha sido cancelado luego de confirmarse un pago. En caso exista un reclamo o queja, se usara el chat como prueba para tomar las medidas del caso.',
                        message_type: 'SYSTEM',
                        content_type: 'TEXT',
                        visible_to: 'SELLER',
                        created_at: new Date()
                    }, { transaction: t });
                }
            }

            await LogPanelGM.create({
                userAction: panelUser,
                action: skipReturnPoints ? 'Cancelar chat sin retorno de puntos' : 'Cancelar chat de usuario',
                user: chat.id,
                amount: 0,
                type: 21,
                date: new Date(),
            }, { transaction: t });

            const effectiveUser = chat.seller;

            if (action === 'CANCEL_CHAT_RETURN') {
                const returned = await this.returnItem(chat.seller, null, chat.trade_id, 3, t, true);

                if (!returned.success) {
                    return {
                        success: false,
                        code: returned.code || '200',
                        message: returned.code === '201'
                            ? 'El vendedor no tiene espacio disponible en su inventario.'
                            : returned.message || 'No se pudo retornar el item.'
                    };
                }

                await TradeActions.create({
                    chat_id: chat.id,
                    user: effectiveUser,
                    action: 'CANCEL_CHAT_RETURN',
                }, { transaction: t });

                await TradeMessage.create({
                    chat_id: chat.id,
                    sender: null,
                    message: 'El chat ha sido cancelado por un administrador',
                    message_type: 'SYSTEM',
                    content_type: 'TEXT',
                    visible_to: 'BOTH',
                    created_at: new Date()
                }, { transaction: t });

                await TradeMessage.create({
                    chat_id: chat.id,
                    sender: null,
                    message: 'Tu item ha sido regresado a tu inventario',
                    message_type: 'SYSTEM',
                    content_type: 'TEXT',
                    visible_to: 'SELLER',
                    created_at: new Date()
                }, { transaction: t });

                chat.status = 'CANCELLED';
                await chat.save({ transaction: t });
            }

            if (action === 'CANCEL_CHAT_REPOST') {
                await TradeActions.create({
                    chat_id: chat.id,
                    user: effectiveUser,
                    action: 'CANCEL_CHAT_REPOST',
                }, { transaction: t });

                await TradeMessage.create({
                    chat_id: chat.id,
                    sender: null,
                    message: 'El chat ha sido cancelado por un administrador',
                    message_type: 'SYSTEM',
                    content_type: 'TEXT',
                    visible_to: 'BOTH',
                    created_at: new Date()
                }, { transaction: t });

                const item = await Marketplace.findOne({
                    where: { id: chat.trade_id },
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });

                if (!item) {
                    await t.rollback();
                    return { success: false, code: '200', message: 'Item de marketplace no encontrado.' };
                }

                item.estado = 1;
                await item.save({ transaction: t });

                chat.status = 'CANCELLED';
                await chat.save({ transaction: t });
            }

            if (paymentMeth.type === 'INTERNAL') {
                const userHold = await UserInternalHolds.findOne({
                    where: {
                        trade_id: chat.trade_id,
                        chat_id: chat.id,
                        status: 'HELD'
                    },
                    transaction: t,
                    lock: t.LOCK.UPDATE,
                });

                if (!userHold) {
                    await t.rollback();
                    return { success: false, code: '200', message: 'No se encontro la retencion interna del comprador.' };
                }

                const method = Number(userHold.method_id);
                const price = Number(userHold.amount);
                const skipEventPointReturn = method === 2 && skipReturnPoints === true;

                if (!skipEventPointReturn) {
                    let typeRew = null;
                    let befCurr = 0;
                    let aftCurr = 0;

                    if (method === 1) {
                        const userCash = await Cash.findOne({
                            where: { id: userHold.user },
                            transaction: t,
                            lock: t.LOCK.UPDATE,
                        });

                        if (!userCash) {
                            await t.rollback();
                            return { success: false, code: '200', message: 'No se encontro el cash del comprador.' };
                        }

                        befCurr = Number(userCash.cash);
                        userCash.cash = Number(userCash.cash) + price;
                        aftCurr = userCash.cash;
                        await userCash.save({ transaction: t });
                        typeRew = 2;
                    } else if (method === 2) {
                        const userGame = await UserGameInfo.findOne({
                            where: { name: userHold.user },
                            transaction: t,
                            lock: t.LOCK.UPDATE,
                        });

                        if (!userGame) {
                            await t.rollback();
                            return { success: false, code: '200', message: 'No se encontro la informacion del comprador.' };
                        }

                        befCurr = Number(userGame.clanpoint);
                        userGame.clanpoint = Number(userGame.clanpoint) + price;
                        aftCurr = userGame.clanpoint;
                        await userGame.save({ transaction: t });
                        typeRew = 13;
                    }

                    if (typeRew !== null) {
                        await LogRewardsUser.create({
                            user: userHold.user,
                            origen: 17,
                            recompensa: price,
                            tipo_recompensa: typeRew,
                            last_pr: befCurr,
                            curr_pr: aftCurr,
                            fecha: new Date(),
                        }, { transaction: t });
                    }

                    await TradeMessage.create({
                        chat_id: chat.id,
                        sender: null,
                        message: 'Se te ha retornado el monto retenido de esta transaccion',
                        message_type: 'SYSTEM',
                        content_type: 'TEXT',
                        visible_to: 'BUYER',
                        created_at: new Date()
                    }, { transaction: t });
                } else {
                    await TradeMessage.create({
                        chat_id: chat.id,
                        sender: null,
                        message: 'El chat fue cancelado por un administrador y los puntos de evento retenidos no fueron retornados.',
                        message_type: 'SYSTEM',
                        content_type: 'TEXT',
                        visible_to: 'BUYER',
                        created_at: new Date()
                    }, { transaction: t });
                }

                await UserInternalHolds.create({
                    user: userHold.user,
                    trade_id: chat.trade_id,
                    chat_id: chat.id,
                    method_id: method,
                    amount: price,
                    status: 'CANCELLED',
                    created_at: new Date()
                }, { transaction: t });
            }

            await t.commit();

            return {
                success: true,
                code: '000',
                message: 'El chat #' + String(chat.id) + ' ha sido cancelado'
            };
        } catch (error) {
            try {
                await t.rollback();
            } catch (_) {}

            console.error('Error al cancelar chat desde panel:', error);
            return { success: false, code: '500', message: 'Error interno al cancelar el chat.' };
        }
    }

    async pushAction(payload) {
        const { chat_id, user, action, token, ismodifiedbypanel, panelUser } = payload;
        const t = await sequelize.transaction();

        try {
            // return { success: false, code: "200", message: "Suspendido temporalmente" };
            // 1️⃣ Validar token
            const isPanel = ismodifiedbypanel === true;

            // 1️⃣ Obtener usuario base
            const username = await User.findOne({ where: { apodo: user } });

            if (!username && !isPanel) {
                await t.rollback();
                return { success: false, code: "999", message: "Usuario no encontrado" };
            }

            let message = "";

             // 2️⃣ Validar ban (solo si NO es panel)
            if (!isPanel) {
                const ban = await MarketBanned.findOne({
                    where: { user: username['id'] },
                    transaction: t
                });

                if (ban && (ban.ban_status === 1 || ban.ban_status === 2 || ban.ban_status === 3)) {
                    await t.rollback();
                    return {
                        success: false,
                        code: '200',
                        message: 'No puedes ejecutar ninguna acción en el chat porque estás baneado del mercado.'
                    };
                }
            }

            // 3️⃣ Validar sesión (solo si NO es panel)
            if (!isPanel) {
                const session = await TokenSession.findOne({
                    where: { token, id: username['id'] },
                    transaction: t,
                });

                if (!session) {
                    await t.rollback();
                    return { success: false, code: "999", message: "Token inválido o expirado." };
                }
            } else{
                 const sessionToken = await TokenSession.findOne({
                    attributes: ['token'],
                    where: {
                        token: token,
                        id: panelUser,
                    },
                    transaction: t, // Asociar la transacción con esta consulta
                });

                if(!sessionToken){
                    await t.rollback(); // Revertir la transacción en caso de error
                    console.log("!![GM Panel]".red,' Sesión antigua'.red);
                    return { success: false, code: '002', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
                }
            }

            // 2️⃣ Validar chat y permisos
            const chat = await TradeChats.findOne({
                where: { id: chat_id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!chat) {
                await t.rollback();
                return { success: false, code: "200", message: "Chat no encontrado" };
            }

            // 5️⃣ Usuario efectivo
            let effectiveUser = user;

            if (isPanel) {
                if (action === 'CANCEL_CHAT_RETURN' || action === 'CANCEL_CHAT_REPOST') {
                    effectiveUser = chat.seller;
                }
            }

            // 6️⃣ Validación de permisos
            if (!isPanel && chat.buyer !== user && chat.seller !== user) {
                await t.rollback();
                return { success: false, code: "200", message: "No autorizado" };
            }

            const allActions = await TradeActions.findAll({
                where: { chat_id },
                transaction: t,
                lock: t.LOCK.UPDATE,
            })

            // Buscar si ya existe la acción solicitada
            const alreadyPerformed = allActions.some(a => a.action === action);

            if (alreadyPerformed) {
                await t.rollback();
                return { success: false, code: "200", message: `La acción "${action}" ya fue realizada previamente.` };
            }

            const paymentMeth = await PaymentMethods.findOne({
                where: { id: chat.payment_method_id},
            });
        
            switch (action) {
                case 'RELEASE_ITEM':
                    if(chat.seller !== user) {
                        await t.rollback();
                        return { success: false, code: "200", message: "No autorizado" };
                    }

                    // Si el método es EXTERNAL → debe existir CONFIRM_PAYMENT
                    if (paymentMeth.type === 'EXTERNAL') {
                        const confirmed = allActions.some(a => a.action === 'CONFIRM_PAYMENT');

                        if (!confirmed) {
                            await t.rollback();
                            return {
                                success: false,
                                code: "200",
                                message: "No puedes liberar el item hasta que el comprador confirme el pago."
                            };
                        }
                    }
                    /* Aqui debe haber una funcion para enviar el item (seria buy item api aqui) */

                    const res = await this.buyItems(chat.buyer,null,chat.trade_id,chat.id,3,t);

                    if(res.success){ // Luego sera si se pudo liberar el item (espacio en el inventario del usuario mas que nada)
                        await TradeActions.create({
                            chat_id:chat.id,
                            user: user,
                            action: 'RELEASE_ITEM',
                        },{ transaction: t });

                         await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `El item  ha sido liberado con éxito y fue enviado al inventario del comprador. Cualquiera puede finalizar el chat en estos momentos.`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'BOTH',
                            created_at: new Date()
                        }, { transaction: t });
                        
                        await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `Finaliza el chat para calificar al vendedor.`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'BUYER',
                            created_at: new Date()
                        }, { transaction: t });

                         await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `Finaliza el chat para que el comprador te califique`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'SELLER',
                            created_at: new Date()
                        }, { transaction: t });

                    } else if(!res.success && res.code === '201'){
                        await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `El item no ha podido ser liberado aún porque el comprador no tiene espacio en su inventario.`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'BOTH',
                            created_at: new Date()
                        }, { transaction: t });

                         await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `Libere el item cuando el comprador confirme espacio en su inventario`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'SELLER',
                            created_at: new Date()
                        }, { transaction: t });

                         await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `Por favor, desocupe un espacio en su inventario para que el vendedor pueda liberar el item.`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'BUYER',
                            created_at: new Date()
                        }, { transaction: t });
                    }  else if(!res.success && res.code === '202'){
                        await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `No tienes créditos suficientes para poder liberar el item`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'SELLER',
                            created_at: new Date()
                        }, { transaction: t });
                    } else if(!res.success && res.code === '200'){
                        await t.rollback();
                        return { success: false, code: "200", message: res.message };
                    }
                    break;
                case 'CONFIRM_PAYMENT':
                    if(chat.buyer !== user) {
                        await t.rollback();
                        return { success: false, code: "200", message: "No autorizado" };
                    }

                    if (paymentMeth.type !== 'EXTERNAL') {
                        await t.rollback();
                        return { success: false, code: "200", message: "Este método de pago no requiere confirmación." };
                    }

                    const proofMessage = await TradeMessage.findOne({
                        where: {
                            chat_id: chat.id,
                            sender: chat.buyer,
                            content_type: 'IMAGE'
                        },
                        attributes: ['id'],
                        transaction: t
                    });

                    if (!proofMessage) {
                        await t.rollback();
                        return {
                            success: false,
                            code: "200",
                            message: "Debes enviar un comprobante o prueba de pago antes de confirmar."
                        };
                    }

                     await TradeActions.create({
                            chat_id:chat.id,
                            user: user,
                            action: 'CONFIRM_PAYMENT',
                        },{ transaction: t });
                        

                     await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `El pago ha sido realizado por el comprador. Por favor, verifique el pago antes de liberar el item.`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'SELLER',
                            created_at: new Date()
                        }, { transaction: t });

                     await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `Espere a que el vendedor libere el item.`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'BUYER',
                            created_at: new Date()
                        }, { transaction: t });
                    break;
                case 'CANCEL_CHAT_RETURN':
                case 'CANCEL_CHAT_REPOST':
                    // return { success: false, code: "200", message: "Suspendido temporalmente" };

                    //Verificar si es GM otra vez:
                    if (isPanel) {
                    await LogPanelGM.create(
                        {
                            userAction: panelUser,
                            action: 'Cancelar chat de usuario',
                            user: chat.id,
                            amount: 0,
                            type: 21,
                            date: new Date(),
                        },
                        { transaction: t }
                    );
                }


                    if(isPanel){
                        const existGM = await UsersPanel.findOne({
                            attributes:['id'],
                            where:{
                            user: user,
                            [Op.or]: [ { type: 9 }],
                            },
                            transaction: t,
                        });
                
                        if(!existGM){
                            await t.rollback();
                            console.log("!![GM Panel]".red,' Ya no es GM'.red);
                            return {
                            success: false,
                            code: '200',
                            message: 'Usted no puede realizar ninguna acción porque ya no es GM, esta sesión será cerrada...'
                            };
                        
                        }
                         await LogPanelGM.create(
                            {
                                userAction: panelUser,
                                action: 'Cancelar chat de usuario',
                                user: chat.id,
                                amount: 0,
                                type: 21,
                                date: new Date(),
                            },
                            // { transaction: t }
                        );
                    }

                    if(!isPanel) return { success: false, code: "200", message: "Suspendido temporalmente" };

                     if(chat.seller !== effectiveUser && !isPanel) {
                        await t.rollback();
                        return { success: false, code: "200", message: "No autorizado" };
                    }

                    const releasedChat = allActions.some(a => a.action === 'RELEASE_ITEM');

                    if (releasedChat) {
                        await t.rollback();
                        return {
                            success: false,
                            code: "200",
                            message: isPanel ? "El chat no puede ser cancelado porque ya se liberó el item" : "No puedes cancelar el chat luego de haber liberado el item"
                        };
                    }
                    // Si el método es EXTERNAL → no debe existir CONFIRM_PAYMENT
                    if (paymentMeth.type === 'EXTERNAL') {

                        const confirmed = allActions.some(a => a.action === 'CONFIRM_PAYMENT');

                        if (confirmed) {
                            // await t.rollback();
                            // return {
                            //     success: false,
                            //     code: "200",
                            //     message: "No puedes cancelar el chat luego de haber recibido un pago"
                            // };
                             await TradeMessage.create({
                                chat_id: chat.id,
                                sender: null,
                                message: `El chat ha sido cancelado luego de confirmarse un pago. En caso exista un reclamo o queja, se usará el chat como prueba para tomar las medidas del caso.`,
                                message_type: 'SYSTEM',
                                content_type: 'TEXT',
                                visible_to: 'SELLER',
                                created_at: new Date()
                            }, { transaction: t });
                        }
                    } 

                    if (action=='CANCEL_CHAT_RETURN'){
                  
                        // activar return function.... :)

                        const res = await this.returnItem(chat.seller,null,chat.trade_id,3,t,true);

                        if(res.success){ // Luego sera si se pudo liberar el item (espacio en el inventario del usuario mas que nada)
                            await TradeActions.create({
                                chat_id:chat.id,
                                user: effectiveUser,
                                action: 'CANCEL_CHAT_RETURN',
                            },{ transaction: t });

                            await TradeMessage.create({
                                chat_id: chat.id,
                                sender: null,
                                message: `El chat ha sido cancelado por ` + (isPanel ? "un administrador" : "el vendedor") ,
                                message_type: 'SYSTEM',
                                content_type: 'TEXT',
                                visible_to: 'BOTH',
                                created_at: new Date()
                            }, { transaction: t });   

                            await TradeMessage.create({
                                chat_id: chat.id,
                                sender: null,
                                message: `Tu item ha sido regresado a tu inventario`,
                                message_type: 'SYSTEM',
                                content_type: 'TEXT',
                                visible_to: 'SELLER',
                                created_at: new Date()
                            }, { transaction: t });

                            chat.status = 'CANCELLED';
                            await chat.save({ transaction: t  });

                        } else if(!res.success && res.code === '201'){
                            if(isPanel){
                                return { success: false, code: "200", message: "El vendedor no tiene espacio disponible en su inventario" };
                            } else{
                                await TradeMessage.create({
                                    chat_id: chat.id,
                                    sender: null,
                                    message: `Por favor, desocupe un espacio en su inventario para poder cancelar el chat y devolver el item`,
                                    message_type: 'SYSTEM',
                                    content_type: 'TEXT',
                                    visible_to: 'SELLER',
                                    created_at: new Date()
                                }, { transaction: t });
                             }
                        } else if(!res.success && res.code === '200'){
                            await t.rollback();
                            return { success: false, code: "200", message: res.message };
                        }
                
                        
                    } else if(action=='CANCEL_CHAT_REPOST'){
                        await TradeActions.create({
                            chat_id:chat.id,
                            user: effectiveUser,
                            action: 'CANCEL_CHAT_REPOST',
                        },{ transaction: t });

                         await TradeMessage.create({
                                chat_id: chat.id,
                                sender: null,
                                message: `El chat ha sido cancelado por ` + (isPanel ? "un administrador" : "el vendedor") ,
                                message_type: 'SYSTEM',
                                content_type: 'TEXT',
                                visible_to: 'BOTH',
                                created_at: new Date()
                            }, { transaction: t });   

                        // Re-post en market place
                        const item = await Marketplace.findOne({
                            where: { id: chat.trade_id },
                            transaction: t,
                            lock: t.LOCK.UPDATE,
                        });

                        item.estado = 1;
                        await item.save({ transaction: t });

                        chat.status = 'CANCELLED';
                        await chat.save({ transaction: t  });
                    }

                    if(paymentMeth.type === 'INTERNAL'){
                        //  console.log(1)
                        const UserHolds = await UserInternalHolds.findOne({
                            where: {  trade_id: chat.trade_id, chat_id: chat.id },
                            transaction: t,
                            lock: t.LOCK.UPDATE,
                        });

                        const method = UserHolds.method_id;
                        const price = UserHolds.amount;
                        let typeRew;
                        let befCurr;
                        let aftCurr;

                        console.log(method)

                        if(method == 2){
                             const userGame = await UserGameInfo.findOne({
                                where: { name: UserHolds.user },
                                transaction: t,
                                lock: t.LOCK.UPDATE,
                            });

                            befCurr = userGame.clanpoint;

                            // Retornar retención:
                            userGame.clanpoint = Number(userGame.clanpoint) +  Number(price);
                            aftCurr = userGame.clanpoint;
                            await userGame.save({ transaction: t });
                            typeRew = 13;
                        }

                        await LogRewardsUser.create({  
                            user:UserHolds.user,
                            origen:17,
                            recompensa:price,
                            tipo_recompensa: typeRew,
                            last_pr: befCurr,
                            curr_pr: aftCurr,
                            fecha: new Date(), 
                        }, { transaction: t});

                        await UserInternalHolds.create({
                            user: UserHolds.user,
                            trade_id: chat.trade_id,
                            chat_id: chat.id,
                            method_id: method,
                            amount: price,
                            status: 'CANCELLED',
                            created_at: new Date()
                        }, { transaction: t });

                         await TradeMessage.create({
                                chat_id: chat.id,
                                sender: null,
                                message: `Se te ha retornado el monto retenido de esta transacción`,
                                message_type: 'SYSTEM',
                                content_type: 'TEXT',
                                visible_to: 'BUYER',
                                created_at: new Date()
                            }, { transaction: t }); 
                    }
                 
                    message ='El chat #'+String(chat.id)+ ' ha sido cancelado'
                    
                    break;
                case 'END_CHAT':
                    if(chat.buyer !== user && chat.seller !== user) {
                        await t.rollback();
                        return { success: false, code: "200", message: "No autorizado" };
                    }

                    // console.log(1)

                    const released = allActions.some(a => a.action === 'RELEASE_ITEM');

                    if (!released) {
                        await t.rollback();
                        return { success: false, code: "200", message: "No puedes finalizar el chat hasta que el item sea liberado." };
                    }

                    await TradeActions.create({
                        chat_id:chat.id,
                        user: user,
                        action: 'END_CHAT',
                    },{ transaction: t });

                    await TradeMessage.create({
                            chat_id: chat.id,
                            sender: null,
                            message: `El chat ha sido finalizado por ${user}. Ya no se podrá enviar más mensajes.`,
                            message_type: 'SYSTEM',
                            content_type: 'TEXT',
                            visible_to: 'BOTH',
                            created_at: new Date()
                        }, { transaction: t });
                    chat.status = 'COMPLETED';
                    await chat.save({ transaction: t  });

                    break;

                default:
                    await t.rollback();
                    return { success: false, code: "200", message: "Acción no disponible o no existe" };
            }


            await t.commit();
            return {
                success: true,
                code: "000",
                message,
            };

        } catch (error) {
            try {
            await t.rollback();
            } catch (_) {}
            console.error("❌ Error en sendMessage service:", error);
            return { success: false, code: "500", message: "Error interno al enviar mensaje" };
        }
    }

   async sendMessage(payload) {
    const { chat_id, sender, message, content_type, token, image } = payload;
    const t = await sequelize.transaction();

    try {
        // 1️⃣ Validar token
        const username = await User.findOne({where:{ apodo: sender}});
//    return { success: false, code: "200", message: "Suspendido temporalmente" };
        const session = await TokenSession.findOne({
        where: { token, id: username['id'] },
        transaction: t,
        });
        if (!session) {
        await t.rollback();
        return { success: false, code: "999", message: "Token inválido o expirado." };
        }

        // 2️⃣ Validar chat y permisos
        const chat = await TradeChats.findOne({
        where: { id: chat_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
        });
        if (!chat) {
        await t.rollback();
        return { success: false, code: "404", message: "Chat no encontrado" };
        }

        if (chat.buyer !== sender && chat.seller !== sender) {
        await t.rollback();
        return { success: false, code: "403", message: "No autorizado" };
        }

        // 3️⃣ Preparar datos del mensaje
        const isImage = content_type === "IMAGE";
        const created = new Date();

        const dbMsg = {
            chat_id,
            sender,
            message: message,
            message_type: "USER",
            content_type: isImage ? "IMAGE" : "TEXT",
            file_url: isImage ? image || null : null, // la URL viene ya del front
            created_at: created,
        };

        const saved = await TradeMessage.create(dbMsg, { transaction: t });
        await t.commit();

        // 4️⃣ Emitir por socket
        const payloadSocket = {
        type: "TRADE_NEW_MESSAGE",
        chat_id,
        message: {
            id: saved.id,
            sender,
            message: saved.message,
            content_type: saved.content_type,
            file_url: saved.file_url ? saved.file_url : null,
            message_type: saved.message_type,
            created_at: saved.created_at,
            visible_to: saved.visible_to,
        },
        };

        return {
        success: true,
        code: "000",
        message: "Mensaje enviado correctamente",
        msg: payloadSocket.message,
        };
    } catch (error) {
        try {
        await t.rollback();
        } catch (_) {}
        console.error("❌ Error en sendMessage service:", error);
        return { success: false, code: "500", message: "Error interno al enviar mensaje" };
    }
    }

  async getHistory({ chat_id, user }) {
    try {
      // Validar chat y participante
      const chat = await TradeChats.findOne({ where: { id: chat_id } });
      if (!chat) return { success: false, code: '404', message: 'Chat no encontrado' };
      if (chat.buyer !== user && chat.seller !== user) return { success: false, code: '403', message: 'No autorizado' };

      // Obtener mensajes ordenados (ASC)
      const messages = await TradeMessages.findAll({
        where: { chat_id },
        order: [['created_at', 'ASC'], ['id', 'ASC']],
      });

      // Filtrar visible_to: mostrar BOTH o el rol correspondiente
      const role = (user === chat.buyer) ? 'BUYER' : 'SELLER';
      const visible = messages.filter(m => {
        if (!m.visible_to || m.visible_to === 'BOTH') return true;
        if (m.visible_to === role) return true;
        return false;
      });

      return { success: true, code: '000', messages: visible };
    } catch (error) {
      console.error('Error getHistory service:', error);
      return { success: false, code: '500', message: 'Error interno al obtener historial' };
    }
  }

   async getPayments() {
    try {
      return await publicDataCache.getOrLoad(PUBLIC_CACHE_KEYS.MARKET_PAYMENTS, PUBLIC_CACHE_TTL.VLONG, async () => {
        const payments = await PaymentMethods.findAll({where:{active:1}, raw: true});

        return payments ? payments : [];
      });
    } catch (error) {
      console.error('Error getHistory service:', error);
      return { success: false, code: '500', message: 'Error interno al obtener historial' };
    }
  }

   async initChatTrade(user, token, idmarket) {
  const t = await sequelize.transaction();
  try {
    //    return { success: false, code: "200", message: "Suspendido temporalmente" };
    const ban = await MarketBanned.findOne({
        where: { user },
        transaction: t
    });

    if (ban && (ban.ban_status === 2 || ban.ban_status === 3)) {
        await t.rollback();
        return {
            success: false,
            code: '200',
            message: 'No puedes inicializar un chat en el mercado porque estás baneado.'
        };
    }
    // 1) validar token-session (lock)
    const session = await TokenSession.findOne({
      where: { token, id: user }, // según tu esquema
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!session) {
      await t.rollback();
      return { success: false, code: '999', message: 'Token inválido o expirado.' };
    }

    // 2) obtener item marketplace (lock)
    const item = await Marketplace.findOne({
      where: { id: idmarket },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!item) {
      await t.rollback();
      return { success: false, code: '200', message: 'El ítem no existe.' };
    }

    const tempitem = await TempUserItemInfo.findOne({
      where: { id: item.itemid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // Solo validar si el item es 8004
    if (tempitem.itemid === 8004) {

        // 1️⃣ Obtener id real del usuario desde usergameinfo
        const userInfo = await UserGameInfo.findOne({
            where: { name: user },
            transaction: t
        });

        const userId = userInfo?.id;

        if (!userId) {
            return { success: false, code: '200', message: 'Usuario no encontrado' };
        }

        // 2️⃣ Verificar si ya tiene 8004 en pendingpresents
        const hasPending8004 = await PendingPresents.findOne({
            where: {
            user_id: userId,
            present_id: 8004
            },
            transaction: t
        });

        // 3️⃣ Verificar si ya tiene 8004 en inventario
        const hasItem8004 = await UserItemInfo.findOne({
            where: {
            userid: userId,
            itemid: 8004
            },
            transaction: t
        });

        if (hasPending8004 || hasItem8004) {
             await t.rollback();
            return {
            success: false,
            code: '200',
            message: 'Ya tienes un Golem en tu inventario o en regalos. Solo se puede tener uno por cuenta.'
            };
        }
    }

    // Paso 1: Obtener todos los personajes del usuario
   
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

    const characters = await CharacterInfo.findAll({
        where: {
            userid: userGame.id,
        },
        transaction: t,
    });

     const valMrk= await ConfigParameters.findOne({
                    where: {
                    name: 'max_lvl_market'
                    },
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });
    
    const maxLevelMarket = parseInt(valMrk.value);

    // Paso 3: Verificar si alguno tiene nivel >= 20
    const hasLevel20OrMore = characters.some(char => char.level >= maxLevelMarket);

    // Paso 2: Validar si tiene personajes
    if (!characters || characters.length === 0) {
        await t.rollback();
        console.log('[Error] No tiene personajes'.red);
        return {
            success: false,
            code: '200',
            message: 'Debes tener personajes con nivel superior a '+maxLevelMarket+' para comprar un item en trades',
        };
    }

    if (!hasLevel20OrMore) {
        await t.rollback();
        console.log('[Error] Ningún personaje con nivel suficiente'.red);
        return {
            success: false,
            code: '200',
            message: 'Debes tener personajes con nivel superior a '+maxLevelMarket+' para comprar un item en trades',
        };
    }

    // 3) comprobar estado disponible (1)
    if (Number(item.estado) !== 1) {
      await t.rollback();
      return { success: false, code: '200', message: 'El ítem no está disponible para trade.' };
    }

     // 🔹 Buscar users
    const users = await User.findAll({
        attributes: ['id', 'apodo'], // o el campo donde guardas el nickname
        transaction: t
    });

    // 🔹 Mapear para obtener apodos fácilmente
    const buyerUser = users.find(u => u.id === user)['apodo'];
    const sellerUserName = users.find(u => u.apodo === item.vendedor)['id']; // name no apodo

    // 4) evitar iniciar sobre tu propio item
    if (String(item.vendedor) === String(buyerUser)) {
      await t.rollback();
      return { success: false, code: '200', message: 'No puedes iniciar chat sobre tu propio item.' };
    }

    // 5) obtener metodo de pago (lock)
    const method = await PaymentMethods.findOne({
      where: { id: item.medio_pago, active: 1 },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!method) {
      await t.rollback();
      return { success: false, code: '200', message: 'Método de pago no válido o inactivo.' };
    }

    // 6) comprobar si hay un chat ACTIVO para este item
    const activeChat = await TradeChats.findOne({
      where: { trade_id: idmarket,  status: ['ACTIVE', 'COMPLETED'], },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (activeChat) {
      await t.rollback();
      return { success: false, code: '200', message: 'Ya existe un chat activo para este ítem.' };
    }

    // DEFINICIONES: ids para internos
    const PM_ID_CASH = 1;
    const PM_ID_PUNTOS = 2;
    const price = Number(item.precio || 0);
    console.log(price);

    // --------- Si es INTERNAL: verificar saldo, descontar y crear retención ANTES de crear chat ----------
    if (method.type === 'INTERNAL') {

    var typeRew = 2;
    var befCurr = 0;
    var aftCurr = 0;

      if (method.id === PM_ID_CASH) {
         // Sumar "price" en logbuycashitem
        // const [sumCashItemResult] = await sequelize.query(
        //     `SELECT COALESCE(SUM(price), 0) AS total FROM logbuycashitem WHERE userid = ${userGameId}`,
        //     { type: sequelize.QueryTypes.SELECT, transaction: t }
        // );

        // // Sumar "buycash" en logbuypoweruser
        // const [sumPowerUserResult] = await sequelize.query(
        //     `SELECT COALESCE(SUM(buycash), 0) AS total FROM logbuypoweruser WHERE userid = ${userGameId}`,
        //     { type: sequelize.QueryTypes.SELECT, transaction: t }
        // );
        // const totalCashSpent = sumCashItemResult.total + sumPowerUserResult.total;

        // var coDis;
        // var flagC = 0;

        const userCash = await Cash.findOne({
          where: { id: user },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        befCurr = userCash.cash;

        typeRew = 2;

        // if(totalCashSpent > 12000){
        //     coDis = userGame.gold;
        // } else {
        //     coDis = userGame.gold - (12000 - totalCashSpent);
        //     flagC = 1;
        // }

        // if(flagC == 1 && coDis < price){
        //     await t.rollback();
        //     return { success: false, code: '200', message: 'No puedes usar los 12000 de oro otorgado en el registro para este trade.' };
        // } else if(flagC == 0 && coDis < price){
        //     await t.rollback();
        //     return { success: false, code: '200', message: 'No tienes suficiente Oro para iniciar este trade.' };
        // }

        if(!userCash || userCash.cash < price){
            await t.rollback();
            return { success: false, code: '200', message: 'No tienes suficiente Cash para iniciar este trade.' };
        }

        // Descontar cash
        userCash.cash -= price;
        aftCurr = userCash.cash;
        await userCash.save({ transaction: t });

      } else if (method.id === PM_ID_PUNTOS) {

        const userGame = await UserGameInfo.findOne({
          where: { name: user },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        befCurr = userGame.clanpoint;
        typeRew = 13;

        // PUNTOS: revisar Cash.cash por id = user (según tu esquema)
        if (!userGame || Number(userGame.clanpoint) < price) {
          await t.rollback();
          return { success: false, code: '200', message: 'No tienes suficientes Puntos de evento.' };
        }
        // Descontar puntos
        userGame.clanpoint = Number(userGame.clanpoint) - price;
        aftCurr = userGame.clanpoint;
        await userGame.save({ transaction: t });

      } else {
        await t.rollback();
        return { success: false, code: '200', message: 'Método de pago no soportado.' };
      }

       await LogRewardsUser.create({  
            user:user,
            origen:17,
            recompensa:-1*(price),
            tipo_recompensa: typeRew,
            last_pr: befCurr,
            curr_pr: aftCurr,
            fecha: new Date(), 
        }, { transaction: t});
    }

    // --------- Crear chat (si no hay chat activo) ----------

    const chat = await TradeChats.create({
      trade_id: idmarket,
      buyer: buyerUser,
      seller: item.vendedor,
      payment_method_id: method.id,
      status: 'ACTIVE',
      created_at: new Date()
    }, { transaction: t });

    // Registrar retención (luego de crear el chat)
      await UserInternalHolds.create({
        user,
        trade_id: idmarket,
        chat_id: chat.id,
        method_id: method.id,
        amount: price,
        status: 'HELD',
        created_at: new Date()
      }, { transaction: t });

    await TradeActions.create({
        chat_id:chat.id,
        user: buyerUser,
        action: 'CREATE_TRADE',
    },{ transaction: t });

    // --------- Mensajes SYSTEM iniciales (con visible_to: BOTH / SELLER / BUYER) ----------
    // Para INTERNAL: mostramos retención al BOTH y damos instrucciones al VENDEDOR (SELLER)
    if (method.type === 'INTERNAL') {
      const label = method.id === PM_ID_CASH ? 'Cash' : 'Puntos de evento';

      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Se han retenido ${price} de ${label} al comprador.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'SELLER',
        created_at: new Date()
      }, { transaction: t });

       await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Se han retenido ${price} de ${label} de tu cuenta.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'BUYER',
        created_at: new Date()
      }, { transaction: t });

      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Libera el ítem cuando corresponda para completar el trade.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'SELLER',
        created_at: new Date()
      }, { transaction: t });

      // También es útil dejar una nota para el comprador (BUYER) sobre cómo proceder
      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Espera a que el vendedor libere el ítem.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'BUYER',
        created_at: new Date()
      }, { transaction: t });

    } else {
      // EXTERNAL: mensaje instructivo para ambos y uno para vendedor
      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Confirma el pago cuando lo realices.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'BUYER',
        created_at: new Date()
      }, { transaction: t });

      await TradeMessage.create({
        chat_id: chat.id,
        sender: null,
        message: `Espera la confirmación de pago del comprador. Cuando el comprador presione "Confirmar pago", podrás liberar el ítem.`,
        message_type: 'SYSTEM',
        content_type: 'TEXT',
        visible_to: 'SELLER',
        created_at: new Date()
      }, { transaction: t });
    }

    // --------- Marcar marketplace en proceso (estado = 3) ----------
    await Marketplace.update({ estado: 3 }, { where: { id: idmarket }, transaction: t });

    // justo después de crear los mensajes SYSTEM
        const history = await TradeMessage.findAll({
            where: { chat_id: chat.id },
            order: [['created_at', 'ASC']],
            transaction: t
        });

      const actions = await TradeActions.findAll({
            where: { chat_id: chat.id },
            order: [['created_at', 'ASC']],
            transaction: t
        });
 
      await t.commit();

      // 5️⃣ Armar payload
      return {
        success: true,
        code: '000',
        message: 'Chat inicializado correctamente.',
        chat: {
          id: chat.id,
        }
      };

  } catch (error) {
    try { await t.rollback(); } catch(_) {}
    console.error('Error en initChatTrade:', error);
    return { success: false, code: '500', message: 'Error interno del servidor.' };
  }
}

async getUserChats(user, token) {
    const t = await sequelize.transaction();
    try {

        // 1️⃣ VALIDAR TOKEN
        const session = await TokenSession.findOne({
            where: { token, id: user },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!session) {
            await t.rollback();
            return { success: false, code: "999", message: "Token inválido." };
        }

        // 2️⃣ Obtener apodo del usuario
        const userInfo = await User.findOne({
            where: { id: user },
            transaction: t
        });

        if (!userInfo) {
            await t.rollback();
            return { success: false, code: "999", message: "Usuario no encontrado." };
        }

        const apodo = userInfo.apodo;

        // 3️⃣ Buscar todos los chats donde participa
        const chats = await TradeChats.findAll({
            where: {
                [Op.or]: [
                    { buyer: apodo },
                    { seller: apodo }
                ]
            },
            transaction: t
        });

        if (!chats.length) {
            await t.commit();
            return {
                success: true,
                code: "000",
                chats: []
            };
        }

        const chatIds = chats.map(c => c.id);
        const tradeIds = chats.map(c => c.trade_id);
        const paymentMethodIds = chats.map(c => c.payment_method_id);

        // 4️⃣ Historial general (para obtener último mensaje)
        const allMessages = await TradeMessage.findAll({
            where: { chat_id: chatIds },
            order: [['created_at', 'DESC']],
            transaction: t
        });

        // 5️⃣ Info de trades
        const tradeItems = await Marketplace.findAll({
            where: { id: tradeIds },
            transaction: t
        });

        // Obtener itemid del marketplace
        const itemIds = tradeItems.map(i => i.itemid);

        // 6️⃣ UserItemInfo (exp, level...)
        const itemGeneralInfo = await TempUserItemInfo.findAll({
            where: { id: itemIds },
            attributes: ['id','exp','item_sn','level','limittime','sn_type','itemid'],
            transaction: t
        });

        const itemIdsG = itemGeneralInfo.map(i => i.itemid);

        const uiiMap = itemGeneralInfo.reduce((m, x) => { m[x.id] = x; return m }, {});

        // 7️⃣ ItemInfo (name y class)
        const itemInfos = await ItemInfo.findAll({
            where: { id: itemIdsG },
            transaction: t
        });


        const itemInfoMap = itemInfos.reduce((m, x) => { m[x.id] = x; return m }, {});

        // 8️⃣ Imágenes del ítem
        const itemImages = await ItemImage.findAll({
            where: { item: itemIdsG },
            transaction: t
        });

        const imageMap = itemImages.reduce((m, x) => {
            m[x.item] = x.image;
            return m;
        }, {});

        // 9️⃣ Métodos de pago
        const paymentMethods = await PaymentMethods.findAll({
            where: { id: paymentMethodIds },
            transaction: t
        });

        const paymentMap = paymentMethods.reduce((m, pm) => {
            m[pm.id] = pm;
            return m;
        }, {});

        await t.commit();

        // 🔟 Construir lista final
        const formatted = chats.map(chat => {

            // mensajes del chat filtrados

            const sortedMessages = [...allMessages].sort((a, b) =>
                new Date(a.created_at) - new Date(b.created_at)
            );

            // mensajes del chat filtrados (ya ordenados)
            const messages = sortedMessages.filter(m => m.chat_id === chat.id);
            // Ignorar mensajes SYSTEM
            const userMessages = messages.filter(m => m.message_type !== "SYSTEM");

            let lastMessage = "(sin mensajes aún)";
            let lastDate = null;

            if (userMessages.length > 0) {
                const last = userMessages[userMessages.length - 1];
                lastDate = last.created_at;

                if (last.content_type === "IMAGE") {
                    // Si es imagen
                    if (last.message && last.message.trim() !== "") {
                        lastMessage = last.message;        // imagen con texto
                    } else {
                        lastMessage = "[IMAGEN]";         // imagen sin texto
                    }
                } else {
                    // Mensaje normal
                    lastMessage = last.message || "(sin mensajes aún)";
                }
            }

            // const lastDate = userMessages.length
            //     ? userMessages[userMessages.length - 1].created_at
            //     : null;

            const item = tradeItems.find(i => i.id === chat.trade_id) || {};

            const uii = uiiMap[item.itemid] || {};
            const info = itemInfoMap[uii.itemid] || {};
            const img = imageMap[uii.itemid] ||
                "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png";

            // nombre del ítem (con class)
            const className = info.Class ? setClassName(info.Class) : '';
            const fullName = info.name ? `${info.name}${className}` : "Desconocido";

            // método de pago
            const pm = paymentMap[chat.payment_method_id] || null;

            return {
                chat_id: chat.id,
                trade_id: chat.trade_id,
                with: chat.buyer === apodo ? chat.seller : chat.buyer,
                status: chat.status,

                // 📌 último mensaje relevante
                last_message: lastMessage,
                last_date: lastDate,

                // 📌 cantidad TOTAL (incluye system)
                total_messages: messages.length,

                create:chat.created_at,

                // 📌 item
                item: {
                    id: item.id,
                    itemid: item.itemid,
                    name: fullName,
                    exp: uii.exp || 0,
                    level: uii.level || 0,
                    image: img
                },

                // 📌 método de pago
                method: pm ? {
                    id: pm.id,
                    name: pm.name,
                    icon: pm.icon,
                    color: pm.color,
                    type: pm.type
                } : null
            };
        });

        formatted.sort((a, b) => {
            const dateA = a.last_date ? new Date(a.last_date) : new Date(a.create);
            const dateB = b.last_date ? new Date(b.last_date) : new Date(b.create);

            return dateB - dateA;
        });

        return {
            success: true,
            code: "000",
            chats: formatted
        };

    } catch (error) {
        console.error("❌ Error en getUserChats:", error);
        await t.rollback();
        return { success: false, code: "999", message: "Error interno del servidor." };
    }
}

async getChat(user, token, chatId) {
    const t = await sequelize.transaction();
    try {
      // 1️⃣ Validar token-session
      const session = await TokenSession.findOne({
        where: { token, id: user },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!session) {
        await t.rollback();
        return { success: false, code: '999', message: 'Token inválido o expirado.' };
      }

      // 2️⃣ Buscar chat existente
      const chat = await TradeChats.findOne({
        where: { id: chatId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!chat) {
        await t.rollback();
        return { success: false, code: '999', message: 'Chat no encontrado.' };
      }

      const userinfo = await User.findOne({where:{id:user}, transaction: t,});

      if(chat.seller !== userinfo.apodo && chat.buyer !== userinfo.apodo){
        await t.rollback();
        return { success: false, code: '999', message: 'No estas autorizado para ver este chat.' };
      }

      // 3️⃣ Obtener datos del método de pago y trade
      const item = await Marketplace.findOne({
        where: { id: chat.trade_id },
        transaction: t,
      });

       // ⭐ Obtener UserItemInfo del ítem
      const uii = await TempUserItemInfo.findOne({
        where: { id: item.itemid },
        attributes: ['id','exp','item_sn','level','limittime','sn_type','itemid'],
        transaction: t
      });

      // ⭐ Obtener info general del ítem (nombre, clase)
      const info = await ItemInfo.findOne({
        where: { id: uii.itemid },
        transaction: t
      });

      // ⭐ Obtener imagen del ítem
      const itemImage = await ItemImage.findOne({
        where: { item: uii.itemid },
        transaction: t
      });

      // ⭐ Construir nombre + class
      const className = info?.Class ? setClassName(info.Class) : "";
      const fullName = info?.name ? `${info.name}${className}` : "Desconocido";

      const finalItem = {
        id: item.id,
        itemid: item.itemid,
        name: fullName,
        exp: uii?.exp || 0,
        level: uii?.level || 0,
        image: itemImage?.image ||
          "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png"
      };

      // 8) Determinar rol que se está calificando (BUYER o SELLER)
        let roleReviewed = null;
        if (String(userinfo.apodo) === String(chat.buyer)) {
            roleReviewed = 'SELLER';
        } else if (String(userinfo.apodo) === String(chat.seller)) {
            roleReviewed = 'BUYER';
        } else {
            await t.rollback();
            return { success: false, code: '200', message: 'El usuario no participa en este chat' };
        }

      const IsQualified = await TradeRatings.findOne({
        where:{rater_name:userinfo.apodo, target_name: chat.seller,role:roleReviewed},
        transaction: t,
      })

      const method = await PaymentMethods.findOne({
        where: { id: chat.payment_method_id },
        transaction: t,
      });

      // 4️⃣ Obtener historial de mensajes
      const history = await TradeMessage.findAll({
        where: { chat_id: chat.id },
        order: [['created_at', 'ASC']],
        transaction: t,
      });

        const actions = await TradeActions.findAll({
            where: { chat_id: chat.id },
            order: [['created_at', 'ASC']],
            transaction: t
        });
 

      await t.commit();

      // 5️⃣ Armar payload
      return {
        success: true,
        code: '000',
        message: 'Chat obtenido correctamente.',
        chat: {
          id: chat.id,
          trade_id: chat.trade_id,
          buyer: chat.buyer,
          seller: chat.seller,
          qlfy: IsQualified ? 1 : 0,
          method: method ? {
            id: method.id,
            name: method.name,
            icon: method.icon,
            color: method.color,
            type: method.type
          } : null,
          status: chat.status,
          history: history.map(m => ({
            id: m.id,
            sender: m.sender,
            message: m.message,
            message_type: m.message_type,
            content_type: m.content_type,
            created_at: m.created_at,
            file_url: m.file_url,
            visible_to: m.visible_to,
          })),
          actions,
          item: finalItem,
        },
      };
    } catch (error) {
      console.error("❌ Error en getChat:", error);
      await t.rollback();
      return { success: false, code: '999', message: 'Error interno del servidor.' };
    }
  }

    async sellItem(user,token,id,price,currency) {
        const t = await sequelize.transaction(); // Iniciar una transacción
        try {
            //    return { success: false, code: "200", message: "Suspendido temporalmente" };

             const ban = await MarketBanned.findOne({
                where: { user },
                transaction: t
            });

            if (ban && (ban.ban_status === 1 || ban.ban_status === 3)) {
                await t.rollback();
                return {
                    success: false,
                    code: '200',
                    message: 'No puedes vender en el mercado porque estás baneado.'
                };
            }

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
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para tradear.' };
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
                    message: 'El item no existe o ya lo has publicado en trades',
                };
            }

            if (userItem && userItem.characterid!==0) {
               await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'El item está en un personaje'.blue);
                return { success: false, code: '200', message: 'Tu item está en un personaje, devuelvelo al inventario para poder tradearlo.' };
            }

            const itmprb = await ConfigParameters.findOne({
                where: {
                name: 'market_banned'
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            const itemProhibido = JSON.parse(itmprb.value);

            if (itemProhibido.includes(userItem.itemid)) {
                await t.rollback();
                console.log(`[Error] El item está prohibido para la venta (itemid: ${userItem?.itemid})`.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Este item no puede ser comercializado.',
                };
            }

             const typeNotRef = [9,10,11,13,14];

            const itemType = await ItemInfo.findOne({
                where: {
                    // id: idi,
                    id: userItem.itemid, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
                lock: t.LOCK.UPDATE,
            });

             if (userItem && typeNotRef.includes(itemType.type)){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'Este tipo de item no se puede tradear'.blue);
                const typeName = setTypeName(itemType.type);
                return { success: false, code: '100', message: 'No se puede tradear este tipo de item (Tipo : '+ typeName +').' };
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

            // Paso 1: Obtener todos los personajes del usuario
            const characters = await CharacterInfo.findAll({
                where: {
                    userid: userGame.id,
                },
                transaction: t,
            });

            const valMrk= await ConfigParameters.findOne({
                    where: {
                    name: 'max_lvl_market'
                    },
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });
    
            const maxLevelMarket = parseInt(valMrk.value);

            // Paso 3: Verificar si alguno tiene nivel >= 20
            const hasLevel20OrMore = characters.some(char => char.level >= maxLevelMarket);

            // Paso 2: Validar si tiene personajes
            if (!characters || characters.length === 0) {
                await t.rollback();
                console.log('[Error] No tiene personajes'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Debes tener personajes con nivel superior a '+maxLevelMarket+' para publicar tu item en trades',
                };
            }

            if (!hasLevel20OrMore) {
                await t.rollback();
                console.log('[Error] Ningún personaje con nivel suficiente'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Debes tener personajes con nivel superior a '+maxLevelMarket+' para publicar tu item en trades',
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

            // Verificar medio de pago
            const valCurr = await PaymentMethods.findOne({where:{id:currency,active:1}});

            if(!valCurr){
                 await t.rollback();
                console.log('[Error] Medio de pago no disponible'.red);
                return {
                    success: false,
                    code: '200',
                    message: 'Este medio de pago no existe.',
                };
            }

            // Aquí continuarías con el proceso de venta (registro en marketplace, moverlo a otra tabla, etc.)

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
                sn_type: userItem.sn_type, // O el valor que corresponda
                level: userItem.level || 0,
                limittime: userItem.limittime || 0,
                slot: userItem.slot || 0,
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

             const fullName = itemInfo.name + setClassName(itemInfo.Class);

            // 8. Buscar imagen en ItemImages
            const itemImage = await ItemImage.findOne({
                where: { item: tempUserItemInfo.itemid },
                transaction: t,
            });

            purchaseDetails.push({
                name: fullName,
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

                const fullName = itemInfo.name + setClassName(itemInfo.Class);
          
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
                  name: fullName,
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

            // Obtener ratings promedio de cada vendedor
            const sellerIds = [...new Set(items.map(i => i.vendedor))]; 

            const sellerRatingsRaw = await TradeRatings.findAll({
                attributes: [
                    'target_name',
                    [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_reviews']
                ],
                where: {
                    target_name: sellerIds,
                    role: 'SELLER'
                },
                group: ['target']
            });

            // Crear mapa: sellerId → { avg_rating, total_reviews }
            const sellerRatingMap = sellerRatingsRaw.reduce((map, r) => {
                const data = r.toJSON();
                map[data.target_name] = {
                    avg_rating: Number(data.avg_rating).toFixed(2),
                    total_reviews: Number(data.total_reviews)
                };
                return map;
            }, {});

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


            const medioPagoIds = [...new Set(items.map(i => i.medio_pago))]; // IDs únicos
            const paymentMethods = await PaymentMethods.findAll({
                where: { id: medioPagoIds },
                attributes: ['id', 'name', 'color', 'icon'], // Ajusta si tus columnas tienen otro nombre
            });

            const paymentMap = paymentMethods.reduce((map, pm) => {
                map[pm.id] = pm;
                return map;
            }, {});

            // // Combinar los resultados
            const mergedItemsFinal = mergedItems.map(item => {
                // Buscar la información de useriteminfo correspondiente al itemid
                // console.log(item)
                const iiRaw = itemInfoMap[item.uii.itemid];
                const ii = iiRaw ? iiRaw.toJSON() : {};
                const className = ii ? setClassName(ii.Class): ''; // obtener el texto del class
                const fullName = ii.name ? `${ii.name}${className}` : 'Desconocido'; // concatenar si hay nombre
                const imageUrl = imageMap[item.uii.itemid] || 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/480px-No_image_available.svg.png';

                 // Calcular diferencia de horas
                // const fechaMarketplace = new Date(item.fecha); // fecha de la base de datos
                // const ahora = new Date(); // fecha actual
                // const diferenciaMs = ahora - fechaMarketplace; // Diferencia en milisegundos
                // const horasPasadas = diferenciaMs / (1000 * 60 * 60); // Convertir a horas

                // const returnFlag = horasPasadas >= 24; // true si pasaron 24h o más, false si no

                const paymentInfo = paymentMap[item.medio_pago]
                ? paymentMap[item.medio_pago].toJSON()
                : { name: 'Desconocido', color: '#999', icon: null };

                  // ⭐ Rating del vendedor
                    const sellerRating = sellerRatingMap[item.vendedor] || {
                        avg_rating: "0.00",
                        total_reviews: 0
                    };

                // Fusionar la información del item original con la información adicional
                return {
                    ...item,
                    ii: {
                        ...ii,
                        name: fullName, // sobrescribe el name con el name + class
                    },
                    url: imageUrl, // Añade la propiedad .url
                    payment: paymentInfo, // ✅ Añadido aquí
                    seller_rating: sellerRating,
                };
            });

            mergedItemsFinal.sort((a, b) => {
                const ratingA = parseFloat(Number(a.seller_rating.avg_rating)) || 0;
                const ratingB = parseFloat(Number(b.seller_rating.avg_rating)) || 0;

                return ratingB - ratingA;
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
                        [Op.in]: ['comission_selling', 'min_price_sell','price_days','temporal_items'] // aquí pones los name que quieras traer
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
