
import { Sequelize,Op, Transaction } from 'sequelize';
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
import CharacterInfo from '../models/characterInfo.js';
import PrizesGame from '../models/prizesGamesModel.js';
import Matches from '../models/matchesModel.js';
import EventLevelCharacter from '../models/eventLevelChModel.js';
import UserPoisons from '../models/userPoisonsModel.js';
import PendingPresents from '../models/pendingPresentsModel.js';
import UserItemInfo from '../models/userItemInfoModel.js';
import { calculatePowerUse, getAmountItem } from '../utils/prizesUtils.js';
import SetItem from '../models/setItemsModel.js';
import TicketOro from '../models/ticketsOroModel.js';
import Ticket from '../models/ticketsModel.js';
import RewardsBox from '../models/rewardsBoxModel.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import UnclassifiedPrizes from '../models/unclassifiedPrizesModel.js';
import EventPoint from '../models/eventPointsModel.js';
import UserAsset from '../models/userAssetsModel.js';
import AssetPrice from '../models/assetsPriceModel.js';
import ConfigParameters from '../models/configParametersModel.js';
import TicketsMode from '../models/ticketsModeModel.js';

class GamesService {

    async getPrizeByGame(game,clase,user,modalidad,transaction) {
        try {
            let allP;
            let rP;
            let cP;
            let sI;
            let params = {};

            switch (game) {
                case 1:

                    const ctnProbabiliy = await ConfigParameters.findOne({
                        where: { name: 'countdown_prob' },
                        transaction,
                    });

                    const prob1 = ctnProbabiliy ? parseFloat(ctnProbabiliy.value) : 0;

                    if(Math.random() < (1-prob1)) {
                        return {all: null, win:false,params,ms:'Mejor suerte la próxima vez. No has recibido nada esta vez.'};
                    }

                    allP = await PrizesGame.findAll({
                        attributes: ['id','orderPrize','type', 'prize', 'name','clase', 'probability','limite','users'],
                        where: {
                        //orderPrize: orderPrize,
                        type_game: game,
                        },
                        order: [['orderPrize', 'ASC']],
                        transaction, // Asociar la transacción con esta consulta
                    })

                    // Realizar el calculo de probabilidad:
                    rP = Math.random();
                    cP = 0;
                    sI = 0;

                    //console.log(allPrizes.length);

                    for (let i = 0; i < allP.length; i++) {
                        //console.log(allPrizes[i]);
                        cP += allP[i].probability;
                        if (rP <= cP) {
                            sI = i;
                        break;
                        }
                    }

                    Object.assign(params, {
                        _pw:sI,
                    });

                    return {all: allP[sI], win:true,params};
                case 3:
                    const prizeCard = await PrizesGame.findOne({
                        attributes: ['id','orderPrize','type', 'prize', 'name','clase','url', 'probability','limite','users'],
                        where: {
                        orderPrize: clase,
                        // clase: clase,
                        type_game: game,
                        },
                        order: [['orderPrize', 'ASC']],
                        transaction, // Asociar la transacción con esta consulta
                    });

                    return {all: prizeCard, win:true};
                case 2:
                    const allPrizes = await PrizesGame.findAll({
                        attributes: ['id','orderPrize','type', 'prize', 'name','clase', 'probability','limite','users','url'],
                        where: {
                        //orderPrize: orderPrize,
                        type_game: game,
                        },
                        order: [['clase','ASC'],['orderPrize', 'ASC']],
                        transaction, // Asociar la transacción con esta consulta
                    })

                    const rouletteProbabiliy = await ConfigParameters.findOne({
                        where: { name: 'roulette_prob' },
                        transaction,
                    });

                    const rouletteProbabiliy2 = await ConfigParameters.findOne({
                        where: { name: 'roulette_prob2' },
                        transaction,
                    });

                     const incProb = await ConfigParameters.findOne({
                        where: { name: 'inc_roul_prob' },
                        transaction,
                    });

                    // console.log(rouletteProbabiliy);
        
                    //Modalidad 1: cash, 2 : oro
                   const prob = modalidad === 1 ? rouletteProbabiliy.value : rouletteProbabiliy2.value;

                   console.log("Prob: ",prob);

                    if(Math.random() < (1-prob)) {
                        
                        const  giros = await UserAsset.findOne({
                            // attributes: ['tickets'],
                            where: {
                              user: user,
                              asset: modalidad === 1 ? 3 : 4
                            },
                            transaction, // Asociar la transacción con esta consulta
                            lock: transaction.LOCK.UPDATE,
                          });

                         // await t.rollback(); // Revertir la transacción en caso de error
                         if(!giros || giros.amount < 1){
                            await transaction.rollback(); // Revertir la transacción en caso de error
                            return { success: false, code: '001', message:`No tiene tickets suficientes para jugar a la ruleta` };
                        }

                        // Decrementar el giro del usuario
                        await UserAsset.decrement('amount', {
                            by: 1,
                            where: {
                              user: user,
                              asset: modalidad === 1 ? 3 : 4
                            },
                            transaction, // Asociar la transacción con esta operación
                          });

                        const lastClass = allPrizes.reduce((max, item) => {
                            return item.clase > max ? item.clase : max;
                          }, 0); // Iniciar con 0 o cualquier otro valor mínimo válido

                        Object.assign(params, {
                            _pwb:lastClass +1,
                        });

                        return {all: null, win:false,params,ms: '¡Perdiste! Suerte para la próxima :)'};
                    }



                    // Realizar el calculo de probabilidad:
                    const randomProb = Math.random();
                    let cumulativeProb = 0;
                    let selectedItem = 0;

                    // console.log(randomProb);
                    //console.log(allPrizes.length);

                    for (let i = 0; i < allPrizes.length; i++) {
                        //console.log(allPrizes[i]);
                        cumulativeProb += allPrizes[i].probability;
                        if (randomProb <= cumulativeProb) {
                        selectedItem = i;
                        break;
                        }
                    }

                    Object.assign(params, {
                        _pw:selectedItem,
                        _pwb:allPrizes[selectedItem].clase,
                        pr: allPrizes
                    });

                    console.log(allPrizes[selectedItem])

                    return {all: allPrizes[selectedItem], win:true,params};
                default:
                    // const allP = await PrizesGame.findAll({
                    //     attributes: ['id','orderPrize','type', 'prize', 'name','clase', 'probability','limite','users'],
                    //     where: {
                    //     //orderPrize: orderPrize,
                    //     type_game: game,
                    //     },
                    //     order: [['orderPrize', 'ASC']],
                    //     transaction, // Asociar la transacción con esta consulta
                    // })

                    // // Realizar el calculo de probabilidad:
                    // const rP = Math.random();
                    // let cP = 0;
                    // let sI = 0;

                    // //console.log(allPrizes.length);

                    // for (let i = 0; i < allP.length; i++) {
                    //     //console.log(allPrizes[i]);
                    //     cP += allP[i].probability;
                    //     if (rP <= cP) {
                    //         sI = i;
                    //     break;
                    //     }
                    // }

                    return null;
            }
        } catch (error) {
            await transaction.rollback(); // Revertir la transacción en caso de error
            console.error('Error al obtener premios:', error);
            throw new Error('Error interno del servidor');
        }
    }


    /**
     * Guarda un ítem para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveItem(userId,prize,t) {
        try {
             // Obtener el ID de usuario desde UserGameInfo por su nombre
             const userGameInfo = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                name: userId, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGameInfo) {
                await t.rollback(); // Revertir la transacción en caso de error
                return { success: false, code: '200', message: 'ID de Usuario no encontrado' };
            }
            
            // Agregar el premio a PendingPresents usando el ID de usuario obtenido
            await PendingPresents.create(
                {
                    present_id: prize.prize,
                    user_id: userGameInfo.id, // Usar el ID de usuario obtenido
                    added_time: new Date(),
                },
                {
                    transaction: t, // Asociar la transacción con esta operación
                }
            );

            console.log(prize);
            // Verificar si el premio es una pocion :
            const itemData = await ItemInfo.findOne({
                attributes: ['type'],
                where: {
                    id: prize.prize, // Cambia esto para usar el nombre de usuario correcto
                },
                // transaction: t, // Asociar la transacción con esta consulta
            });
        
            // if (!itemData) {
            //   await transaction.rollback(); // Revertir la transacción en caso de error
            //   return { success: false, code: '402', message: 'ID de Item no encontrado' };
            // }
            console.log(itemData);
            if(itemData && itemData.type === 12){
                //Insertar en tabla poisions :)
                //Verificar si el usuario ya tiene esa pocion:
                const userPocion = await UserPoisons.findOne({
                    where: {
                    idpocion: prize.prize, // Cambia esto para usar el nombre de usuario correcto
                    user: userId,
                    },
                    //transaction: t, // Asociar la transacción con esta consulta
                });
        
                if (!userPocion) {
                    await UserPoisons.create(
                    {
                        user: userId,
                        idpocion: prize.prize,
                        cantidad: 1,
                    },
                    {
                        //transaction: t, // Asociar la transacción con esta operación
                    }
                    );
                } else{
                    await UserPoisons.increment(
                    'cantidad',
                    { by: 1, where: { user: userId,idpocion: prize.prize }/*, transaction: t*/ }
                    );
                }
            }
            
            return { message:`Has obtenido un(a) ${prize.name}`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar item:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda oro para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveOro(userId,prize,t) {
        try {

            const uCoin = await UserGameInfo.findOne({
                where: {name:userId},
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

             const lastuCoin = uCoin.gold;
             uCoin.gold += prize.prize;
             await uCoin.save({ transaction: t });
            
            return { message:`Has obtenido ${prize.prize} de Oro`, success: true,last:lastuCoin,curr: uCoin.gold };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar oro:', error);
            throw new Error('Error interno del servidor');
        }
    }

     /**
     * Guarda cash para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
     async saveCash(userId,prize,t) {
        try {

            const uCoin = await Cash.findOne({
                where: {id:userId},
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            const lastuCoin = uCoin.cash;

            uCoin.cash += prize.prize;
            await uCoin.save({ transaction: t });

            return { message:`Has obtenido ${prize.prize} de Cash`, success: true,last:lastuCoin,curr: uCoin.cash };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar cash:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda tickets de cash para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveTicketsCash(userId,prize,t) {
        try {
             // Actualizar el ticket de cash
             await Ticket.increment(
                'tickets',
                { by: prize.prize, where: { id: userId }, transaction: t }
            );
            return { message:`Has obtenido ${prize.prize} ticket(s) de cash`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar tickets de cash:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda tickets de oro para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveTicketsOro(userId,prize,t) {
        try {
            // Actualizar el ticket de oro
            await TicketOro.increment(
                'tickets',
                    { by: prize.prize, where: { id: userId }, transaction: t }
                );
        
            return { message:`Has obtenido ${prize.prize} ticket(s) de oro`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar tickets de oro:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda items temporales para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveItemTemporal(userId,prize,t) {
        try {
            //Obtener id de usuario
            // Obtener el ID de usuario desde UserGameInfo por su nombre
            const userGame = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                name: userId, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGame) {
                await t.rollback(); // Revertir la transacción en caso de error
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
                return { success: false, code: '200', message: 'No tiene slots disponbiles para jugar' };
            }

            const days = 2;
            const limit = await calculatePowerUse(0,days);
            const responseAmount = await getAmountItem(prize.prize,t);

            if(responseAmount.success === false && responseAmount.code === '402'){
                return responseAmount;
            }
            //console.log(limit);

            //Si tiene, guardar el premio temporal en useriteminfo
            await UserItemInfo.create(
                {
                    userid: userGame.id,
                    itemid: prize.prize,
                    slot: slotFree,
                    limittime: limit, //calculo como power use
                    exp: responseAmount,
                },
                {
                    transaction: t, // Asociar la transacción con esta operación
                }
            );

            return { message:`Has obtenido un(a) ${prize.name} temporal (${String(days)} días)`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar item temporal:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda poweruser para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async savePowerUser(userId,prize,t) {
        try {
            // Obtener el powertime de usuario desde UserGameInfo por su nombre
            const userGamePower = await UserGameInfo.findOne({
                attributes: ['powertime'],
                where: {
                name: userId, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGamePower) {
                await t.rollback(); // Revertir la transacción en caso de error
                return { success: false, code: '200', message: 'Usuario no encontrado' };
            }

            const powertimefinal = await calculatePowerUse(userGamePower.powertime,prize.prize);
            //console.log(powertimefinal);
            await UserGameInfo.update(
                { powertime: powertimefinal}, //cambiar a codigo_base
                { where: { name: userId },
                transaction: t 
                },
            );

            return { message:`Has obtenido ${prize.prize} días de Power User`, success: true,last:userGamePower.powertime,curr: powertimefinal};
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar poweruser:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda set de items para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveSetItems(userId,prize,t) {
        try {
            // Insertar un SET

            // Obtener el ID de usuario desde UserGameInfo por su nombre
            const userGameInfoID = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                name: userId, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGameInfoID) {
                await t.rollback(); // Revertir la transacción en caso de error
                return { success: false, code: '200', message: 'ID de Usuario no encontrado' };
            }

            //console.log(pr.prize);
            //Obtener todos los id's del set:
            const itemsSet = await SetItem.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('itemid')), 'itemid']],
                where: {
                idset: prize.prize,
                },
                raw: true,
                transaction: t,
            });

            // Mapear los resultados a un array de números
            const arrayItems = itemsSet.map((item) => item.itemid);
            //console.log(arrayItems);

            // Crear los registros para bulkCreate
            const presentRecords = arrayItems.map(itemid => ({
                present_id: itemid,
                user_id: userGameInfoID.id,
                added_time: new Date()
            }));

            // Insertar los registros en PendingPresents
            await PendingPresents.bulkCreate(presentRecords, { transaction: t });

            return { message:`Has obtenido un(a) ${prize.name}`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar set de items:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda paquete de premios para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveRewardBox(game,userId,prize,t) {
        try {
            // Buscar todos los premios de la tabla rewardsbox por game y prize.prize
            const rewards = await RewardsBox.findAll({
                where: { game: game, clase: prize.prize },
                transaction: t
            });

            if (!rewards) {
                await t.rollback();
                return { success: false, code: '200', message: 'No se encontraron premios para el paquete especificado' };
            }

            // Buscar el userId del usuario dado su username dentro de la transacción
            const user = await UserGameInfo.findOne({
                where: { name: userId },
                transaction:t // Añadir transacción aquí
            });

            if (!user) {
                await t.rollback(); 
                return { success: false, code: '200', message: 'No existe el usuario' };
            }

            // Recorrer el arreglo rewards y verificar si reward.multiple es true o false
            for (const r of rewards) {

                const typePrize = r.tipo;
                const name = r.paquete;
                const selectedPrize = {};
                var res;
                // console.log(r);

                if (r.multiple) {
                    // Lógica cuando reward.multiple es true
                    // console.log(`El premio ${r.premio} es múltiple.`);
                    const opciones =JSON.parse(r.options);

                     // Obtener el characterid de la tabla eventlevelcharacter por user
                    const eventCharacter = await EventLevelCharacter.findOne({
                        attributes: ['characterid'],
                        where: { user: userId },
                        transaction: t
                    });

                    if (!eventCharacter) {
                        await t.rollback();
                        return { success: false, code: '999', message: '¡El usuario aún no ha seleccionado un personaje!' };
                    }

                    // Buscar el personaje específico según el characterid en existingEntry
                    const characterSelected = await CharacterInfo.findOne({
                        attributes: ['id', 'name', 'level', 'Class'],
                        where: {
                            userid: user.id,
                            id: eventCharacter.characterid
                        },
                        transaction:t // Añadir transacción aquí
                    });

                    const classCh = characterSelected.Class;
                    selectedPrize['name'] = name;
                    selectedPrize['prize'] = Number(opciones[classCh]);

                    res = await this.setWinPrizes(game,typePrize,selectedPrize,userId,t);
                    // Aquí puedes agregar la lógica específica para premios múltiples
                } else {
                    // Lógica cuando reward.multiple es false
                    // console.log(`El premio ${r.premio} no es múltiple.`);
                    selectedPrize['name'] = name;
                    selectedPrize['prize'] = r.premio;
                    res = await this.setWinPrizes(game,typePrize,selectedPrize,userId,t);
                    // Aquí puedes agregar la lógica específica para premios no múltiples
                }

                if(!res.success) return res;
            }

            return { message:`Has obtenido el paquete de nivel ${(prize.prize + 1)*5}`, success: true};
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar el paquete de premios:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda premios aun no clasificados para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveUnclassified(game,userId,prize,typePrize,t) {
        try {
            
            // Insertar el premio en la tabla unclassifiedprizes
            await UnclassifiedPrizes.create({
                user: userId,
                prize: prize.prize,
                name: prize.name,
                type: typePrize,
                game: game
            }, {
                transaction: t // Asociar la transacción con esta operación
            });

            return { message:`Has obtenido un(a) ${prize.name}`, success: true};
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar el paquete de premios:', error);
            throw new Error('Error interno del servidor');
        }
    }

     /**
     * Guarda oro aleatorio al usuario, basado en un rango especificado en prize.name.
     *
     * @param {string} userId - Identificador del usuario.
     * @param {Object} prize - Objeto premio, cuya propiedad `name` viene en formato "min-max".
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
     async saveBolsaOro(game,userId,prize,t) {
        try {

            const uCoin = await UserGameInfo.findOne({
                where: {name:userId},
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

             const lastuCoin = uCoin.gold;
            
            // 1. Partir el rango "100-2000" en sus dos extremos
            const [minStr, maxStr] = prize.name.split('-');
            const min = parseInt(minStr, 10);
            const max = parseInt(maxStr, 10);

            // 2. Generar un entero aleatorio entre min y max (inclusive)
            let amount;

            if(game == 4){
                const matchg = await Matches.findOne({
                    where:{ user:userId, estado: 1, game }
                })

                const texto = JSON.parse(matchg.nombres)[0]
                amount = parseInt(texto.match(/\d+/)[0], 10);
            } else{
                amount = Math.floor(Math.random() * (max - min + 1)) + min;
            }

            // 3. Incrementar el oro del usuario por el valor aleatorio calculado
            uCoin.gold += amount;
             await uCoin.save({ transaction: t });

            return { message:`Has obtenido ${amount} de Oro de la Bolsa`, success: true, bv:amount,last:lastuCoin,curr: uCoin.gold };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar oro:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda oro aleatorio al usuario, basado en un rango especificado en prize.name.
     *
     * @param {string} userId - Identificador del usuario.
     * @param {Object} prize - Objeto premio, cuya propiedad `name` viene en formato "min-max".
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
     async saveBolsaCash(game,userId,prize,t) {
        try {

             const uCoin = await Cash.findOne({
                where: {id:userId},
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            const lastuCoin = uCoin.cash;

            // 1. Partir el rango "100-2000" en sus dos extremos
            const [minStr, maxStr] = prize.name.split('-');
            const min = parseInt(minStr, 10);
            const max = parseInt(maxStr, 10);

            // 2. Generar un entero aleatorio entre min y max (inclusive)
            let amount;

            if(game == 4){
                const matchg = await Matches.findOne({
                    where:{ user:userId, estado: 1 , game}
                })

                const texto = JSON.parse(matchg.nombres)[0]
                amount = parseInt(texto.match(/\d+/)[0], 10);
            } else{
                amount = Math.floor(Math.random() * (max - min + 1)) + min;
            }

            // 3. Incrementar el cash del usuario por el valor aleatorio calculado
            uCoin.cash += amount;
            await uCoin.save({ transaction: t });

            return { message:`Has obtenido ${amount} de Cash de la Bolsa`, success: true, bv:amount, last:lastuCoin,curr: uCoin.cash  };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar cash:', error);
            throw new Error('Error interno del servidor');
        }
    }

     /**
     * Guarda giros de ruleta para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
     async saveGiroRuleta(userId,prize,t) {
        try {
             // Actualizar giros
            const userAsset = await UserAsset.findOne({
                where: {
                    user: userId,
                    asset: 3,
                },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (userAsset) {
                // Si ya tiene el asset, incrementar la cantidad
                userAsset.amount += prize.prize;
                await userAsset.save({ transaction: t });
                // console.log('Asset actualizado:'.green, `Cantidad actualizada a ${userAsset.amount}`.green);
            } else {
                // Si no tiene el asset, crear un nuevo registro
                // console.log(AssetBuy);
                await UserAsset.create(
                {
                    user: userId,
                    asset: 3,
                    amount: prize.prize,
                },
                { transaction: t }
                );
                // console.log('Asset añadido:'.green, `Cantidad inicial ${cantidad}`.green);
            }

            return { message:`Has obtenido ${prize.prize} giro(s) de ruleta`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar giros de ruleta:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda picas de minar para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
     async savePicaDeMina(userId,prize,t) {
        try {
             // Actualizar giros
            const userAsset = await UserAsset.findOne({
                where: {
                    user: userId,
                    asset: 4,
                },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (userAsset) {
                // Si ya tiene el asset, incrementar la cantidad
                userAsset.amount += prize.prize;
                await userAsset.save({ transaction: t });
                // console.log('Asset actualizado:'.green, `Cantidad actualizada a ${userAsset.amount}`.green);
            } else {
                // Si no tiene el asset, crear un nuevo registro
                // console.log(AssetBuy);
                await UserAsset.create(
                {
                    user: userId,
                    asset: 4,
                    amount: prize.prize,
                },
                { transaction: t }
                );
                // console.log('Asset añadido:'.green, `Cantidad inicial ${cantidad}`.green);
            }

            return { message:`Has obtenido ${prize.prize} pica(s) de minar`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar giros de ruleta:', error);
            throw new Error('Error interno del servidor');
        }
    }


    /**
     * Guarda tickts de theme park para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveThemeParkTicket(userId,prize,t) {
        try {
             // Actualizar giros
             const tcksStage = await TicketsMode.findOne({
                where:{
                  user: userId,
                  type:1,
                  mode:71,
                },
                transaction: t, // Asociar la transacción con esta consulta
                lock: t.LOCK.UPDATE,
              });
        

            if (tcksStage) {
                // Si ya tiene el asset, incrementar la cantidad
                tcksStage.tickets += prize.prize;
                await tcksStage.save({ transaction: t });
                // console.log('Asset actualizado:'.green, `Cantidad actualizada a ${userAsset.amount}`.green);
            } else {
                // Si no tiene el asset, crear un nuevo registro
                // console.log(AssetBuy);
                await TicketsMode.create(
                {
                    user: userId,
                    type:1,
                    mode:71,
                    tickets: prize.prize,
                },
                { transaction: t }
                );
                // console.log('Asset añadido:'.green, `Cantidad inicial ${cantidad}`.green);
            }

            return { message:`Has obtenido ${prize.prize} ticket(s) para theme park`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar tickets de theme park :', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda tickts de theme park para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
    async saveThemeParkTicket2(userId,prize,t) {
        try {
             // Actualizar giros
             const tcksStage = await TicketsMode.findOne({
                where:{
                  user: userId,
                  type:1,
                  mode:72,
                },
                transaction: t, // Asociar la transacción con esta consulta
                lock: t.LOCK.UPDATE,
              });
        

            if (tcksStage) {
                // Si ya tiene el asset, incrementar la cantidad
                tcksStage.tickets += prize.prize;
                await tcksStage.save({ transaction: t });
                // console.log('Asset actualizado:'.green, `Cantidad actualizada a ${userAsset.amount}`.green);
            } else {
                // Si no tiene el asset, crear un nuevo registro
                // console.log(AssetBuy);
                await TicketsMode.create(
                {
                    user: userId,
                    type:1,
                    mode:72,
                    tickets: prize.prize,
                },
                { transaction: t }
                );
                // console.log('Asset añadido:'.green, `Cantidad inicial ${cantidad}`.green);
            }

            return { message:`Has obtenido ${prize.prize} ticket(s) para theme park`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar tickets de theme park :', error);
            throw new Error('Error interno del servidor');
        }
    }

    async setWinPrizes(game,typePrize,prize,userId,t){
        try {
            // Agregar el premio según el tipo
            var response = null;
            const excludedPrizes = [10,11, 98, 99];
            // console.log(1);
            // console.log(typePrize);
            // console.log(prize);

            var regBolsa = 0;

            switch (typePrize) {
                case 0:
                    response = await this.saveItem(userId,prize,t);
                    break;
                case 1:
                    response = await this.saveOro(userId,prize,t);
                    break;
                case 2:
                    response = await this.saveCash(userId,prize,t);
                    break;
                case 3:
                    response = await this.saveTicketsCash(userId,prize,t);
                    break;
                case 4:
                    response = await this.saveTicketsOro(userId,prize,t);
                    break;
                case 5:
                    response = await this.saveItemTemporal(userId,prize,t);
                    break;
                case 6:
                    response = await this.savePowerUser(userId,prize,t);
                    break;
                case 7:
                    response = await this.saveThemeParkTicket(userId,prize,t);
                    break;
                case 8:
                    response = await this.saveBolsaOro(game,userId,prize,t);
                    regBolsa=1;
                    break;
                case 9:
                    response = await this.saveBolsaCash(game,userId,prize,t);
                    regBolsa=1;
                    break;
                case 10:
                    // console.log('a');
                    response = await this.saveSetItems(userId,prize,t);
                    break;
                case 11:
                    // console.log(2);
                    response = await this.saveRewardBox(game,userId,prize,t);
                    break;
                case 12:
                    // console.log(2);
                    response = await this.saveGiroRuleta(userId,prize,t);
                    break;
                case 17:
                    response = await this.saveThemeParkTicket2(userId,prize,t);
                    break;
                case 18:
                    // console.log(2);
                    response = await this.savePicaDeMina(userId,prize,t);
                    break;
                case 98:
                case 99:
                    response = await this.saveUnclassified(game,userId,prize,typePrize,t);
                    break;
                default:
                    await t.rollback(); // Revertir la transacción en caso de error
                    response =  { success: false, code: '201', message: 'Tipo de premio no válido' };
                    break;
            }
            // console.log(3);

            if (!excludedPrizes.includes(typePrize)) {
                await LogRewardsUser.create({  
                    user:userId,
                    origen:1,
                    recompensa:(typePrize === 8 || typePrize===9) ? response.bv: prize.prize,
                    tipo_recompensa: typePrize,
                    origen_2: game,
                    last_pr: response.last ? response.last : 0,
                    curr_pr: response.curr ? response.curr : 0,
                    fecha: new Date(), 
                }, { transaction:t });
            }

            return response;

        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al buscar y guardar premio:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async findMatch(game,user,transaction){
        try {
            var match;
            switch (game) {
                case 3:

                 // Obtener el userid desde usergameinfo
                    const userGameInfo = await UserGameInfo.findOne({
                        attributes: ['id'],
                        where: { name: user },
                        transaction // Añadir transacción aquí
                    });

                    if (!userGameInfo) {
                        throw new Error('Usuario no encontrados');
                    }

                    const userId = userGameInfo.id;

                    let newUser = false;
                    let userCharacters = null;
                    let characterSelected = null;

                    // Verificar si el usuario ya ha seleccionado un personaje en eventlevelcharacter
                    const existingEntry = await EventLevelCharacter.findOne({
                        where: { user: user },
                        transaction // Añadir transacción aquí
                    });
                
                    if (!existingEntry) {
                        newUser = true;
                        // Insertar nuevo registro en eventlevelcharacter
                        // await EventLevelCharacter.create({ user: user, characterid: null }, { transaction });
                        userCharacters = await CharacterInfo.findAll({
                            attributes: ['id','name', 'level', 'Class'],
                            where: { userid: userId },
                            transaction // Añadir transacción aquí
                        });
                    } else{
                        // Buscar el personaje específico según el characterid en existingEntry
                        characterSelected = await CharacterInfo.findOne({
                            attributes: ['id', 'name', 'level', 'Class'],
                            where: {
                                userid: userId,
                                id: existingEntry.characterid
                            },
                            transaction // Añadir transacción aquí
                        });
                    }

                    const niveles = Array.from({ length: 8 }, (_, index) => {
                        if (index === 19) {
                            return 99;
                        } else {
                            return (index + 1) * 5;
                        }
                    });

                    // console.log(levelsSuperados);
                    // console.log(niveles);

                    // Crear array de partida
                    let nuevaPartidaArray;

                    if (characterSelected) {
                        // Verificar solo el nivel del personaje seleccionado
                        const characterLevel = characterSelected.level;
                        nuevaPartidaArray = niveles.map(nivel => characterLevel >= nivel ? false : true);
                    } else {
                        // Configurar todo el array con true
                        nuevaPartidaArray = Array(niveles.length).fill(true);
                    }

                    match = await Matches.findOne({
                        attributes: ['id','partida', 'premios_obtenidos'],
                        where: {
                          user: user,
                          game: game,
                          estado: 1,
                        },
                        transaction // Añadir transacción aquí
                    });

                    if (match) {
                         // Actualizar partida existente

                        // Convertir premios_obtenidos a un array
                        let premiosObtenidos = JSON.parse(match.premios_obtenidos);

                        // Verificar si la longitud es menor a 8
                        if (premiosObtenidos.length < 11) {
                            // Agregar null hasta que la longitud sea 8
                            premiosObtenidos = [...premiosObtenidos, ...Array(8 - premiosObtenidos.length).fill(null)];
                            
                            // Actualizar el campo premios_obtenidos en la base de datos
                            await Matches.update(
                                { premios_obtenidos: JSON.stringify(premiosObtenidos) },
                                { where: { id: match.id }, transaction }
                            );
                        }
                        // const partidaActual = JSON.parse(match.partida);
                        const partidaActualizada = nuevaPartidaArray;//partidaActual.map((estado, index) => levelsSuperados.some(l => l >= niveles[index]) ? false : estado);

                        await Matches.update(
                            { partida: JSON.stringify(partidaActualizada) },
                            { where: { id: match.id }, transaction }
                        );

                        return {
                          mt: partidaActualizada,
                          _pws: premiosObtenidos,
                          new: newUser,
                          uch:userCharacters,
                          chs:characterSelected,
                        };

                      } else {
                        const nuevaPartida = {
                          user: user,
                          partida: JSON.stringify(nuevaPartidaArray),
                          premios_obtenidos: JSON.stringify(Array(8).fill(null)),
                          game: game,
                          estado: 1
                        };

                        match = await Matches.create(nuevaPartida, { transaction });

                        return {
                            mt: nuevaPartidaArray,
                            _pws: JSON.parse(nuevaPartida.premios_obtenidos),
                            new:newUser,
                            uch:userCharacters,
                            chs:characterSelected,
                        };
                    }
                default:
                    return null;
            }
        } catch (error) {
            await transaction.rollback(); // Revertir la transacción en caso de error
            console.error('Error al obtener partida:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async eventLevelVerificator(game,opcion,username,transaction,prize) {
        try {
            
            // Verificar que el usuario se encuentre en ese nivel...

            const nivel = opcion == 19 ? ((opcion + 1) * 5) - 1 : (opcion + 1) * 5;

            // Buscar el userId del usuario dado su username dentro de la transacción
            const user = await UserGameInfo.findOne({
                where: { name: username },
                transaction // Añadir transacción aquí
            });

            // console.log(user);

            if (!user) {
                await transaction.rollback(); 
                return { success: false, code: '200', message: 'No existe el usuario' };
            }

            const userId = user.id;
            // console.log(userId);

            // Verificar si el usuario ya ha seleccionado un personaje en eventlevelcharacter
            const existingEntry = await EventLevelCharacter.findOne({
                where: { user: username },
                transaction // Añadir transacción aquí
            });
        
            if (!existingEntry) {
                await transaction.rollback(); 
                return { success: false, code: '999', message: '¡El usuario aún no ha seleccionado un personaje!' };
            }

            // Buscar el personaje específico según el characterid en existingEntry
            const characterSelected = await CharacterInfo.findOne({
                attributes: ['id', 'name', 'level', 'Class'],
                where: {
                    userid: userId,
                    id: existingEntry.characterid
                },
                transaction // Añadir transacción aquí
            });

            // Verificar si algún personaje está en el nivel especificado
            const hasCharacterAtLevel = characterSelected.level >= nivel;

            if (!hasCharacterAtLevel) {
                await transaction.rollback(); 
                return { success: false, code: '100', message: 'Tu personaje aún no tiene el nivel requerido para abrir esta carta' };
            }

            // Verificar que el usuario no intente abrir una carta que ya haya abierto...
            const match = await Matches.findOne({
                attributes: ['id', 'partida', 'premios_obtenidos'],
                where: {
                    user: username,
                    game: game, // Asegúrate de tener la variable `game` definida aquí
                    estado: 1,
                },
                transaction
            });

            // console.log(match);
            if (match) {
                const premiosObtenidos = JSON.parse(match.premios_obtenidos);
    
                // Verificar si ya ha obtenido premio en el índice especificado
                if (premiosObtenidos[opcion] !== null) {
                    await transaction.rollback();
                    return { success: false, code: '100', message: 'Ya has obtenido un premio en este nivel, no puedes abrir esta carta nuevamente' };
                }

                const rewards = await RewardsBox.findAll({
                    where: { game: game, clase: opcion },
                    transaction
                });
    
                if (!rewards) {
                    await transaction.rollback();
                    return { success: false, code: '200', message: 'No se encontraron premios para el paquete especificado' };
                }
    
                let namePrizesBox = '';
    
                // Recorrer el arreglo rewards y verificar si reward.multiple es true o false
                for (const r of rewards) {
                    const name = r.paquete;
                    namePrizesBox += `- ${name}\n`;
                }

                const prizeob = {
                    id: prize.id,
                    url: prize.url,
                    n: namePrizesBox
                }
                premiosObtenidos[opcion] = prizeob;

                // Convertir de nuevo a JSON string para actualizar en la base de datos
                match.premios_obtenidos = JSON.stringify(premiosObtenidos);
                await match.save({ transaction });

                return {po:premiosObtenidos,success: true};
            }

            return null;
        } catch (error) {
          await transaction.rollback(); // Revertir la transacción en caso de error
          console.error('Error al verificar:', error);
          throw new Error('Error interno del servidor');
        }
    }
}

export default new GamesService();