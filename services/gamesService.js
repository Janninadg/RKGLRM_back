
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
import TicketsMode from '../models/ticketsModeModel.js';
import StagesReset from '../models/stagesResetModel.js';
import TempPrize from '../models/tempPrizes.js';
import UserPrizeTracker from '../models/userPrizeTrackerModel.js';
import prizeGameCache from '../modules/events/prizeGame.cache.js';
import configParameterCache from '../modules/events/configParameter.cache.js';
import {
    checkUniqueAccountItemAvailability,
    isUniqueAccountItem,
} from '../utils/uniqueAccountItems.js';

const sortByOrderPrize = (a, b) => Number(a.orderPrize) - Number(b.orderPrize);

const sortByClassAndOrderPrize = (a, b) => {
    const classA = a.clase === null ? 0 : Number(a.clase);
    const classB = b.clase === null ? 0 : Number(b.clase);

    if (classA !== classB) {
        return classA - classB;
    }

    return sortByOrderPrize(a, b);
};

const DEFAULT_ROULETTE_HARD_PRIZES = [8009, 6046, 7035];
const DEFAULT_ROULETTE_MIN_SPENT = [90000, 90000, 90000];
const ROULETTE_8009_TOTAL_LIMIT = 12;
const ROULETTE_8009_EARLY_LIMIT = 2;
const ROULETTE_8009_EARLY_PROBABILITY = 0.05;
const GENERIC_UNIQUE_GAME_PRIZE_MESSAGE = 'Mejor suerte la próxima vez. No has recibido nada esta vez.';

const getNumberArrayParameter = (name, fallback = []) => {
    const value = configParameterCache.getJson(name, null);
    const source = Array.isArray(value) ? value : fallback;

    return source
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
};

const getPrizeId = (prize) => Number(prize?.prize || 0);

const blockPrizeProbability = (prizes, prizeId) => {
    const blockedIndex = prizes.findIndex((prize) => getPrizeId(prize) === Number(prizeId));

    if (blockedIndex === -1) {
        return false;
    }

    const blockedProb = Number(prizes[blockedIndex].probability || 0);
    prizes[blockedIndex].probability = 0;

    if (blockedProb <= 0) {
        return true;
    }

    const totalRemaining = prizes.reduce((sum, prize, index) => {
        if (index !== blockedIndex) {
            return sum + Number(prize.probability || 0);
        }

        return sum;
    }, 0);

    if (totalRemaining <= 0) {
        return true;
    }

    prizes.forEach((prize, index) => {
        if (index !== blockedIndex) {
            const original = Number(prize.probability || 0);
            const proportion = original / totalRemaining;
            prize.probability = original + (blockedProb * proportion);
        }
    });

    return true;
};

const setPrizeProbability = (prizes, prizeId, probability) => {
    const targetIndex = prizes.findIndex((prize) => getPrizeId(prize) === Number(prizeId));

    if (targetIndex === -1) {
        return false;
    }

    const targetProb = Math.max(0, Math.min(1, Number(probability || 0)));
    prizes[targetIndex].probability = targetProb;

    const remainingProb = 1 - targetProb;
    const otherIndexes = prizes
        .map((_, index) => index)
        .filter((index) => index !== targetIndex);

    if (otherIndexes.length === 0) {
        return true;
    }

    const totalOriginalOthers = otherIndexes.reduce((sum, index) => {
        return sum + Number(prizes[index].probability || 0);
    }, 0);

    otherIndexes.forEach((index) => {
        if (totalOriginalOthers <= 0) {
            prizes[index].probability = remainingProb / otherIndexes.length;
            return;
        }

        const original = Number(prizes[index].probability || 0);
        const proportion = original / totalOriginalOthers;
        prizes[index].probability = remainingProb * proportion;
    });

    return true;
};

const buildMinimumSpentByPrize = (prizes, trackedPrizeIds, minimumSpentValues) => {
    const minimumSpentByPrize = new Map();

    if (minimumSpentValues.length === prizes.length) {
        prizes.forEach((prize, index) => {
            const minimumSpent = Number(minimumSpentValues[index] || 0);

            if (Number.isFinite(minimumSpent) && minimumSpent > 0) {
                minimumSpentByPrize.set(getPrizeId(prize), minimumSpent);
            }
        });
    }

    trackedPrizeIds.forEach((prizeId, index) => {
        const minimumSpent = Number(minimumSpentValues[index] || 0);
        const currentMinimum = Number(minimumSpentByPrize.get(Number(prizeId)) || 0);

        if (Number.isFinite(minimumSpent) && minimumSpent > currentMinimum) {
            minimumSpentByPrize.set(Number(prizeId), minimumSpent);
        }
    });

    return minimumSpentByPrize;
};

class GamesService {

    async getRouletteSpentPerTry(modalidad, transaction) {
        const fallbackSpent = configParameterCache.getNumber('roulette_spent_per_try', 1000);
        const asset = modalidad === 1 ? 3 : 5;

        const priceRecord = await AssetPrice.findOne({
            attributes: ['price'],
            where: { asset },
            transaction,
        });

        const price = Number(priceRecord?.price);
        return Number.isFinite(price) && price > 0 ? price : fallbackSpent;
    }

    async trackPrizeAttempt({ game, user, prizes, minimumSpentByPrize, spentAmount, transaction }) {
        const trackerState = new Map();
        const prizesInGame = new Set(prizes.map((prize) => getPrizeId(prize)));

        for (const [prizeId, minimumSpent] of minimumSpentByPrize.entries()) {
            if (!prizesInGame.has(Number(prizeId)) || Number(minimumSpent) <= 0) {
                continue;
            }

            let tracker = await UserPrizeTracker.findOne({
                where: {
                    user,
                    game,
                    prize: Number(prizeId)
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!tracker) {
                tracker = await UserPrizeTracker.create(
                    {
                        user,
                        game,
                        prize: Number(prizeId),
                        tries: 0,
                        spent: 0
                    },
                    {
                        transaction
                    }
                );
            }

            tracker.tries = Number(tracker.tries || 0) + 1;
            tracker.spent = Number(tracker.spent || 0) + Number(spentAmount || 0);

            await tracker.save({
                transaction
            });

            trackerState.set(Number(prizeId), {
                spent: Number(tracker.spent || 0),
                minimumSpent: Number(minimumSpent)
            });
        }

        return trackerState;
    }

    async userOwnsPrizeItem(userId, prizeId, transaction) {
        if (!userId) {
            return false;
        }

        const uniqueAvailability = await checkUniqueAccountItemAvailability({
            userGameId: userId,
            itemId: prizeId,
            itemName: `Item ${prizeId}`,
            transaction,
        });

        return !uniqueAvailability.allowed;
    }

    async userAlreadyWonPrize(game, user, prizeId, transaction) {
        const tempPrize = await TempPrize.findOne({
            where: {
                user,
                game,
                prize: prizeId
            },
            transaction
        });

        if (tempPrize) {
            return true;
        }

        const rewardLog = await LogRewardsUser.findOne({
            where: {
                user,
                origen: 1,
                origen_2: game,
                recompensa: prizeId
            },
            transaction
        });

        return Boolean(rewardLog);
    }

    async countPrizeRewards(game, prizeId, transaction) {
        return LogRewardsUser.count({
            where: {
                origen: 1,
                origen_2: game,
                recompensa: prizeId
            },
            transaction
        });
    }

    async getPrizeByGame(game,clase,user,modalidad,prizeData,transaction, options = {}) {
        try {
            const isTestMode = Boolean(options.testMode);
            let allP;
            let rP;
            let cP;
            let sI;
            let params = {};

            switch (game) {
                case 1:

                    const prob1 = configParameterCache.getNumber('countdown_prob', 0);

                    if(Math.random() < (1-prob1)) {
                        return {all: null, win:false,params,ms:'Mejor suerte la próxima vez. No has recibido nada esta vez.'};
                    }

                    allP = prizeGameCache.getByGame(game).sort(sortByOrderPrize);

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
                    const prizeCard = prizeGameCache.getByGameAndOrder(game, clase)[0] || null;

                    return {all: prizeCard, win:true};
                case 2:
                    const allPrizes = prizeGameCache.getByGame(game).sort(sortByClassAndOrderPrize);
                    const rouletteHardPrizes = getNumberArrayParameter('roulette_hard_prizes', DEFAULT_ROULETTE_HARD_PRIZES);
                    const rouletteMinimumSpent = getNumberArrayParameter('max_spent_roulette', DEFAULT_ROULETTE_MIN_SPENT);
                    const rouletteMinimumSpentByPrize = buildMinimumSpentByPrize(
                        allPrizes,
                        rouletteHardPrizes,
                        rouletteMinimumSpent
                    );
                    const rouletteSpentPerTry = !isTestMode && rouletteMinimumSpentByPrize.size > 0
                        ? await this.getRouletteSpentPerTry(modalidad, transaction)
                        : 0;
                    const rouletteTrackerState = !isTestMode && rouletteMinimumSpentByPrize.size > 0
                        ? await this.trackPrizeAttempt({
                            game,
                            user,
                            prizes: allPrizes,
                            minimumSpentByPrize: rouletteMinimumSpentByPrize,
                            spentAmount: rouletteSpentPerTry,
                            transaction
                        })
                        : new Map();

                    const rouletteProbabiliy = configParameterCache.getNumber('roulette_prob', 0);

                    const rouletteProbabiliy2 = configParameterCache.getNumber('roulette_prob2', 0);

                    // Lectura reservada para futuro ajuste incremental de probabilidades.
                    // const incProb = configParameterCache.getNumber('inc_roul_prob', 0);

                    // console.log(rouletteProbabiliy);
        
                    //Modalidad 1: cash, 2 : oro o puntos
                   const prob = modalidad === 1 ? rouletteProbabiliy : rouletteProbabiliy2;

                   console.log("Prob: ",prob);

                    if(Math.random() < (1-prob)) {
                        
                        const  giros = isTestMode ? null : await UserAsset.findOne({
                            // attributes: ['tickets'],
                            where: {
                              user: user,
                              asset: modalidad === 1 ? 3 : 5
                            },
                            transaction, // Asociar la transacción con esta consulta
                            lock: transaction.LOCK.UPDATE,
                          });

                         // await t.rollback(); // Revertir la transacción en caso de error
                         if(!isTestMode && (!giros || giros.amount < 1)){
                            await transaction.rollback(); // Revertir la transacción en caso de error
                            return { success: false, code: '001', message:`No tiene tickets suficientes para jugar a la ruleta` };
                        }

                        // Decrementar el giro del usuario
                        if (!isTestMode) {
                        await UserAsset.decrement('amount', {
                            by: 1,
                            where: {
                              user: user,
                              asset: modalidad === 1 ? 3 : 5
                            },
                            transaction, // Asociar la transacción con esta operación
                          });
                        }

                        const lastClass = allPrizes.reduce((max, item) => {
                            return item.clase > max ? item.clase : max;
                          }, 0); // Iniciar con 0 o cualquier otro valor mínimo válido

                          /** dar el 30% de lo que costo... */
                        const priceRecord = isTestMode ? { price: 0 } : await AssetPrice.findOne({
                            where: {
                                asset: modalidad === 1 ? 3 : 5
                            },
                            transaction,
                            lock: transaction.LOCK.UPDATE,
                            });

                            if (!priceRecord) {
                            throw new Error("No se encontró registro de precio");
                            }

                            const isFatalLose = Math.random() < 0.5;

                            // Calcular 30%
                            const refundAmount = Math.floor(Number(priceRecord.price) * 0.30);

                            if (!isTestMode && !isFatalLose && modalidad === 1) {

                            // 🔹 Devolver en CASH
                            await Cash.increment(
                                { cash: refundAmount },
                                {
                                where: { id: user },
                                transaction,
                                lock: transaction.LOCK.UPDATE
                                }
                            );

                            } else if (!isTestMode && !isFatalLose) {

                            // 🔹 Devolver en PUNTOS DE EVENTO (clanpoint)
                            await UserGameInfo.increment(
                                { clanpoint: refundAmount },
                                {
                                where: { name: user },
                                transaction,
                                lock: transaction.LOCK.UPDATE
                                }
                            );

                            }

                        Object.assign(params, {
                            _pwb:lastClass + (isFatalLose ? 2 : 1),
                            loseType: isFatalLose ? 'fatal' : 'refund',
                        });

                        return {
                            all: null,
                            win:false,
                            params,
                            ms: isFatalLose
                                ? '¡Fatal! Perdiste todo. Esta vez no hubo devolución.'
                                : '¡Perdiste! Pero se te devolvió el 30% del costo del ticket gastado. Suerte para la próxima :)'
                        };
                    }

                    // 1️⃣ Obtener id real del usuario desde usergameinfo
                    const userInfo = await UserGameInfo.findOne({
                        where: { name: user },
                        transaction
                    });

                    const userId = userInfo?.id;

                    const userAlreadyHas8004 =
                        await this.userOwnsPrizeItem(userId, 8004, transaction) ||
                        await this.userAlreadyWonPrize(game, user, 8004, transaction);

                    const userAlreadyHas8009 =
                        await this.userOwnsPrizeItem(userId, 8009, transaction) ||
                        await this.userAlreadyWonPrize(game, user, 8009, transaction);

                    const completedTrackedPrizeIds = [];

                    if (userAlreadyHas8004 && rouletteMinimumSpentByPrize.has(8004)) {
                        completedTrackedPrizeIds.push(8004);
                    }

                    if (userAlreadyHas8009 && rouletteMinimumSpentByPrize.has(8009)) {
                        completedTrackedPrizeIds.push(8009);
                    }

                    if (!isTestMode && completedTrackedPrizeIds.length > 0) {
                        await UserPrizeTracker.destroy({
                            where: {
                                user,
                                game,
                                prize: completedTrackedPrizeIds
                            },
                            transaction
                        });
                    }

                    const total8004Game = await TempPrize.count({
                        where: {
                            game: game,
                            prize: 8004
                        },
                        transaction
                    });

                    const total8009Game = await this.countPrizeRewards(game, 8009, transaction);

                    // 🔥 AJUSTE DE PROBABILIDADES
                    const prizeafter = allPrizes;

                    const blockedPrizeIds = new Set();

                    if (userAlreadyHas8004) {
                        blockedPrizeIds.add(8004);
                    }

                    if (userAlreadyHas8009 || total8009Game >= ROULETTE_8009_TOTAL_LIMIT) {
                        blockedPrizeIds.add(8009);
                    }

                    for (const [prizeId, minimumSpent] of rouletteMinimumSpentByPrize.entries()) {
                        const trackerState = rouletteTrackerState.get(Number(prizeId));
                        const currentSpent = Number(trackerState?.spent || 0);

                        if (Number(minimumSpent) > 0 && currentSpent < Number(minimumSpent)) {
                            blockedPrizeIds.add(Number(prizeId));
                        }
                    }

                    blockedPrizeIds.forEach((prizeId) => {
                        blockPrizeProbability(allPrizes, prizeId);
                    });

                    if (
                        !blockedPrizeIds.has(8009) &&
                        !userAlreadyHas8009 &&
                        total8009Game <= ROULETTE_8009_EARLY_LIMIT
                    ) {
                        setPrizeProbability(allPrizes, 8009, ROULETTE_8009_EARLY_PROBABILITY);
                    }

                    //     // 🎯 CASO 2: Nadie ha ganado 8004 en este juego y usuario no lo tiene
                    //     else if (total8004Game <= 3 && !userAlreadyHas8004) {

                    //         const targetProb = 0.4;
                    //         const remainingProb = 1 - targetProb;

                    //         allPrizes[targetIndex].probability = targetProb;

                    //         const otherIndexes = allPrizes
                    //             .map((p, i) => i)
                    //             .filter(i => i !== targetIndex);

                    //         const totalOriginalOthers = otherIndexes.reduce((sum, i) => {
                    //             return sum + Number(allPrizes[i].probability);
                    //         }, 0);

                    //         otherIndexes.forEach(i => {
                    //             const original = Number(allPrizes[i].probability);
                    //             const proportion = original / totalOriginalOthers;
                    //             allPrizes[i].probability = remainingProb * proportion;
                    //         });
                    //     }
                    // }


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
                        pr: prizeafter
                    });

                    // console.log(allPrizes[selectedItem])

                    const selectedPrize = allPrizes[selectedItem];
                    const selectedPrizeId = getPrizeId(selectedPrize);

                    if (!isTestMode && rouletteMinimumSpentByPrize.has(selectedPrizeId)) {
                        await UserPrizeTracker.destroy({
                            where: {
                                user,
                                game,
                                prize: selectedPrizeId
                            },
                            transaction
                        });
                    }

                    return {all: selectedPrize, win:true,params};
                case 6:

                   const prizeChests = prizeGameCache.getByGame(game).sort(sortByOrderPrize);

                    const alreadyWon8004 = await TempPrize.findOne({
                        where: {
                            user: user,
                            game: game,
                            prize: 8004
                        },
                        transaction
                    });

                    const alreadyWon8009 = await this.userAlreadyWonPrize(game, user, 8009, transaction);

                    const allUserTempPrizes = await TempPrize.findAll({
                        where: {
                            user: user,
                            game: game
                        },
                        transaction
                    });

                    const has8004 = allUserTempPrizes.some(p => p.prize === 8004);
                    const has8009 = allUserTempPrizes.some(p => p.prize === 8009);
                    const moreThanTwo = allUserTempPrizes.length > 2;

                    const total8004 = await TempPrize.count({
                        where: { 
                            game,
                            prize: 8004
                        },
                        transaction
                    });

                    const total8009 = await this.countPrizeRewards(game, 8009, transaction);

                    // 2️⃣ Si ya lo ganó, reajustar probabilidades

                    if (alreadyWon8004) {

                        // Encontrar el premio 8004
                        const blockedIndex = prizeChests.findIndex(p => p.prize === 8004);

                        if (blockedIndex !== -1) {

                            const blockedProb = Number(prizeChests[blockedIndex].probability);

                            // Poner probabilidad en 0
                            prizeChests[blockedIndex].probability = 0;

                            // Calcular suma del resto
                            const totalRemaining = prizeChests.reduce((sum, p, i) => {
                                if (i !== blockedIndex) {
                                    return sum + Number(p.probability);
                                }
                                return sum;
                            }, 0);

                            // Redistribuir proporcionalmente
                            prizeChests.forEach((p, i) => {
                                if (i !== blockedIndex) {
                                    const original = Number(p.probability);
                                    const proportion = original / totalRemaining;
                                    p.probability = original + (blockedProb * proportion);
                                }
                            });
                        }
                    } 
                    else if (total8004 <= 3 && !has8004){
                        const golemIndex = prizeChests.findIndex(p => p.prize === 8004);

                        if (golemIndex !== -1) {

                            const targetProb = 1;

                            // Primero quitar la probabilidad actual del golem
                            prizeChests[golemIndex].probability = targetProb;

                            // Redistribuir el restante (10%)
                            const remainingProb = 1 - targetProb;

                            const otherIndexes = prizeChests
                                .map((p, i) => i)
                                .filter(i => i !== golemIndex);

                            const totalOriginalOthers = otherIndexes.reduce((sum, i) => {
                                return sum + Number(prizeChests[i].probability);
                            }, 0);

                            otherIndexes.forEach(i => {
                                const original = Number(prizeChests[i].probability);
                                const proportion = original / totalOriginalOthers;
                                prizeChests[i].probability = remainingProb * proportion;
                            });
                        }
                    }
                    else if (total8004 > 3 && !has8004 && moreThanTwo) {

                        const golemIndex = prizeChests.findIndex(p => p.prize === 8004);

                        if (golemIndex !== -1) {

                            const targetProb = 0.90;

                            // Primero quitar la probabilidad actual del golem
                            prizeChests[golemIndex].probability = targetProb;

                            // Redistribuir el restante (10%)
                            const remainingProb = 1 - targetProb;

                            const otherIndexes = prizeChests
                                .map((p, i) => i)
                                .filter(i => i !== golemIndex);

                            const totalOriginalOthers = otherIndexes.reduce((sum, i) => {
                                return sum + Number(prizeChests[i].probability);
                            }, 0);

                            otherIndexes.forEach(i => {
                                const original = Number(prizeChests[i].probability);
                                const proportion = original / totalOriginalOthers;
                                prizeChests[i].probability = remainingProb * proportion;
                            });
                        }
                    }

                    if (alreadyWon8009 || total8009 >= ROULETTE_8009_TOTAL_LIMIT) {
                        blockPrizeProbability(prizeChests, 8009);
                    }
                    else if (total8009 <= ROULETTE_8009_EARLY_LIMIT && !has8009) {
                        setPrizeProbability(prizeChests, 8009, ROULETTE_8009_EARLY_PROBABILITY);
                    }

                    // console.log(prizeChests);

                    // Realizar el calculo de probabilidad:
                    const randProb = Math.random();
                    let cumProb = 0;
                    let SelIt = 0;

                    // console.log(prizeChests)

                    for (let i = 0; i < prizeChests.length; i++) {
                        cumProb += Number(prizeChests[i].probability);
                        if (randProb <= cumProb) {
                            SelIt = i;
                            break;
                        }
                    }

                    Object.assign(params, {
                        _pw:SelIt,
                    });

                    return {all: prizeChests[SelIt], win:true,params};
               case 8:

                    const userGame = await UserGameInfo.findOne({
                        attributes: ['id', 'bag'],
                        where: { name: user },
                        transaction,
                    });

                    if (!userGame) {
                    return {
                        success: false,
                        code: '200',
                        message: 'ID de Usuario no encontrado'
                    };
                    }

                    const distinctSlots = await UserItemInfo.findAll({
                    attributes: [
                        [Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']
                    ],
                    where: {
                        userid: userGame.id,
                        characterid: 0,
                    },
                    raw: true,
                    transaction,
                    });

                    const distinctSlotsArray = distinctSlots.map((item) => Number(item.slot));

                    const bagCount = Number(userGame.bag || 1);
                    const maxSlotIndex = bagCount * 30 - 1;

                    let slotFree = null;

                    for (let i = 0; i <= maxSlotIndex; i++) {
                    if (!distinctSlotsArray.includes(i)) {
                        slotFree = i;
                        break;
                    }
                    }

                    if (!isTestMode && slotFree === null) {
                        return {
                            success: false,
                            code: '200',
                            message: 'Debes liberar espacio en tu inventario para jugar este juego, ya que recibirás el premio en tu inventario o como regalo pendiente.'
                        };
                    }

                    const prize = prizeGameCache.getById(prizeData.id);

                    if (!prize || prize.type_game !== Number(game)) {
                        return {
                            success: false,
                            code: '404',
                            message: 'Premio no válido'
                        };
                    }

                    const chance = isTestMode ? null : await UserAsset.findOne({
                        where: {
                            user,
                            asset: 6
                        },
                        transaction,
                        lock: transaction.LOCK.UPDATE
                    });

                    if (!isTestMode && (!chance || chance.amount <= 0)) {
                        return {
                            success: false,
                            code: '200',
                            message: 'No tienes chances suficientes.'
                        };
                    }

                    if (!isTestMode) {
                        await UserAsset.decrement('amount', {
                            by: 1,
                            where: {
                                user,
                                asset: 6
                            },
                            transaction
                        });
                    }

                    const maxSpent = configParameterCache.getNumber('max_spent', 50);

                    const probTemporal = configParameterCache.getNumber('prob_temporal', 0.5);

                    let tracker = isTestMode ? null : await UserPrizeTracker.findOne({
                        where: {
                            user,
                            game,
                            prize: prize.id
                        },
                        transaction,
                        lock: transaction.LOCK.UPDATE
                    });

                    if (!isTestMode && !tracker) {
                        tracker = await UserPrizeTracker.create(
                            {
                                user,
                                game,
                                prize: prize.id,
                                tries: 0,
                                spent: 0
                            },
                            {
                                transaction
                            }
                        );
                    }

                    if (!isTestMode) {
                        tracker.tries += 1;
                        tracker.spent += 1;
                    }

                    const forcedWin =
                        !isTestMode && tracker.spent >= maxSpent;

                    const probabilityWin =
                        Math.random() <= Number(prize.probability);

                    const win = forcedWin || probabilityWin;

                    Object.assign(params, {});

                    if (!win) {
                        if (!isTestMode) {
                            await tracker.save({
                                transaction
                            });
                        }

                        return {
                            all: null,
                            win: false,
                            params,
                            ms: 'No ganaste esta vez'
                        };
                    }

                    const isTemporary =
                        Math.random() <= probTemporal ? 1 : 0;

                    if (!isTestMode) {
                        await tracker.destroy({
                            transaction
                        });
                    }

                    params.prize = {
                        id: prize.id,
                        level: 1,
                        tipo: prizeData.tipo,
                        temporal: isTemporary,
                        days: 15,
                    };

                    return {
                        all: prize,
                        win: true,
                        params
                    };

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
    async saveItem(userId, prize, t, prizeParams = null) {
        try {
            const userGameInfo = await UserGameInfo.findOne({
            attributes: ['id', 'bag'],
            where: {
                name: userId,
            },
            transaction: t,
            });

            if (!userGameInfo) {
            await t.rollback();
            return {
                success: false,
                code: '200',
                message: 'ID de Usuario no encontrado'
            };
            }

            const uniqueAvailability = await checkUniqueAccountItemAvailability({
                userGameId: userGameInfo.id,
                itemId: prize.prize,
                itemName: prize.name || `Item ${prize.prize}`,
                transaction: t,
            });

            if (!uniqueAvailability.allowed) {
            await t.rollback();
            return {
                success: false,
                code: '400',
                message: GENERIC_UNIQUE_GAME_PRIZE_MESSAGE
            };
            }

            /*
            Si es criatura y level > 1:
            guardar directo en UserItemInfo
            */

            if (
            prizeParams?.tipo === 0 &&
            Number(prizeParams?.level || 1) > 1
            ) {
            const distinctSlots = await UserItemInfo.findAll({
                attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']
                ],
                where: {
                userid: userGameInfo.id,
                characterid: 0,
                },
                raw: true,
                transaction: t,
            });

            const distinctSlotsArray = distinctSlots.map((item) =>
                Number(item.slot)
            );

            let slotFree = null;

            const bagCount = Number(userGameInfo.bag || 1);
            const maxSlotIndex = bagCount * 30 - 1;

            for (let i = 0; i <= maxSlotIndex; i++) {
                if (!distinctSlotsArray.includes(i)) {
                slotFree = i;
                break;
                }
            }

            if (slotFree === null) {
                await t.rollback();
                return {
                success: false,
                code: '200',
                message: 'No tiene slots disponibles para jugar'
                };
            }

            const responseAmount = await getAmountItem(
                prize.prize,
                t
            );

            await UserItemInfo.create(
                {
                userid: userGameInfo.id,
                itemid: prize.prize,
                slot: slotFree,
                characterid: 0,
                limittime: 0,
                exp: responseAmount,
                level: Number(prizeParams.level || 1),
                },
                {
                transaction: t,
                }
            );

            return {
                message: `Has obtenido un(a) ${prize.name}`,
                success: true
            };
            }

            /*
            flujo normal
            */

            await PendingPresents.create(
            {
                present_id: prize.prize,
                user_id: userGameInfo.id,
                added_time: new Date(),
            },
            {
                transaction: t,
            }
            );

            return {
            message: `Has obtenido un(a) ${prize.name}`,
            success: true
            };
        } catch (error) {
            await t.rollback();
            console.error(error);
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
    async saveItemTemporal(userId, prize, t, prizeParams = null) {
        try {
            const userGame = await UserGameInfo.findOne({
            attributes: ['id', 'bag'],
            where: {
                name: userId,
            },
            transaction: t,
            });

            if (!userGame) {
            await t.rollback();
            return {
                success: false,
                code: '200',
                message: 'ID de Usuario no encontrado'
            };
            }

            const uniqueAvailability = await checkUniqueAccountItemAvailability({
            userGameId: userGame.id,
            itemId: prize.prize,
            itemName: prize.name || `Item ${prize.prize}`,
            transaction: t,
            });

            if (!uniqueAvailability.allowed) {
            await t.rollback();
            return {
                success: false,
                code: '400',
                message: GENERIC_UNIQUE_GAME_PRIZE_MESSAGE
            };
            }

            const distinctSlots = await UserItemInfo.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('slot')), 'slot']
            ],
            where: {
                userid: userGame.id,
                characterid: 0,
            },
            raw: true,
            transaction: t,
            });

            const distinctSlotsArray = distinctSlots.map((item) =>
            Number(item.slot)
            );

            let slotFree = null;

            const bagCount = Number(userGame.bag || 1);
            const maxSlotIndex = bagCount * 30 - 1;

            for (let i = 0; i <= maxSlotIndex; i++) {
            if (!distinctSlotsArray.includes(i)) {
                slotFree = i;
                break;
            }
            }

            if (slotFree === null) {
            await t.rollback();
            return {
                success: false,
                code: '200',
                message: 'No tiene slots disponibles para jugar'
            };
            }

            const days = prizeParams?.days ?? 2;
            const level = prizeParams?.level ?? 1;

            const limit = await calculatePowerUse(0, days);
            const responseAmount = await getAmountItem(prize.prize, t);

            if (
            responseAmount.success === false &&
            responseAmount.code === '402'
            ) {
            return responseAmount;
            }

            await UserItemInfo.create(
            {
                userid: userGame.id,
                itemid: prize.prize,
                slot: slotFree,
                characterid: 0,
                limittime: limit,
                exp: responseAmount,
                level: level,
            },
            {
                transaction: t,
            }
            );

            return {
            message: `Has obtenido un(a) ${prize.name} temporal (${String(days)} días)`,
            success: true
            };
        } catch (error) {
            await t.rollback();
            console.error(error);
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
            const plannedUniqueItemIds = new Set();
            for (const itemId of arrayItems) {
                const numericItemId = Number(itemId);

                if (isUniqueAccountItem(numericItemId) && plannedUniqueItemIds.has(numericItemId)) {
                    await t.rollback();
                    return {
                        success: false,
                        code: '400',
                        message: GENERIC_UNIQUE_GAME_PRIZE_MESSAGE
                    };
                }

                const uniqueAvailability = await checkUniqueAccountItemAvailability({
                    userGameId: userGameInfoID.id,
                    itemId: numericItemId,
                    itemName: `Item ${numericItemId}`,
                    transaction: t,
                });

                if (!uniqueAvailability.allowed) {
                    await t.rollback();
                    return {
                        success: false,
                        code: '400',
                        message: GENERIC_UNIQUE_GAME_PRIZE_MESSAGE
                    };
                }

                if (isUniqueAccountItem(numericItemId)) {
                    plannedUniqueItemIds.add(numericItemId);
                }
            }
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

            return { message:`Has obtenido ${prize.prize} tickets de cash`, success: true };
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
     * Guarda tickets de puntos para el usuario.
     * 
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - ID del premio.
     * @param {string} prize.name - Nombre del premio.
     * @param {Transaction} t - Transacción de Sequelize.
     * @returns {Promise<Object>} Resultado de la operación con éxito o fallo.
     */
     async saveTicketPuntos(userId,prize,t) {
        try {
             // Actualizar giros
            const userAsset = await UserAsset.findOne({
                where: {
                    user: userId,
                    asset: 5,
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
                    asset: 5,
                    amount: prize.prize,
                },
                { transaction: t }
                );
                // console.log('Asset añadido:'.green, `Cantidad inicial ${cantidad}`.green);
            }

            return { message:`Has obtenido ${prize.prize} tickets de puntos`, success: true };
        } catch (error) {
            await t.rollback(); // Revertir la transacción en caso de error
            console.error('Error al guardar giros de ruleta:', error);
            throw new Error('Error interno del servidor');
        }
    }

    /**
     * Guarda tickets de stages para el usuario.
     *
     * @param {string} userId - ID del usuario (nombre del usuario).
     * @param {Object} prize - Objeto del premio que contiene los detalles del premio.
     * @param {number} prize.prize - Cantidad de tickets a entregar.
     * @param {Transaction} t - Transaccion de Sequelize.
     * @param {number} fallbackMode - Ticket/mode de stagesreset para guardar en ticketsmode.
     * @returns {Promise<Object>} Resultado de la operacion con exito o fallo.
     */
    async saveTicketsStages(userId, prize, t, fallbackMode = null) {
        try {
            const ticketsAmount = Number(prize?.prize || 0);
            const stageTicketMode = Number(fallbackMode || 0);

            if (!Number.isInteger(ticketsAmount) || ticketsAmount <= 0) {
                await t.rollback();
                return { success: false, code: '202', message: 'Cantidad de tickets de stage no valida' };
            }

            if (!Number.isInteger(stageTicketMode) || stageTicketMode <= 0) {
                await t.rollback();
                return { success: false, code: '203', message: 'Ticket de stage no configurado' };
            }

            const stageInfo = await StagesReset.findOne({
                where: {
                    ticket: stageTicketMode,
                    // visible: 1,
                },
                transaction: t,
                lock: t.LOCK.UPDATE,
            });

            if (!stageInfo) {
                await t.rollback();
                return { success: false, code: '204', message: 'Ticket de stage no encontrado' };
            }

            const tcksStage = await TicketsMode.findOne({
                where:{
                  user: userId,
                  type:1,
                  mode: stageTicketMode,
                },
                transaction: t,
                lock: t.LOCK.UPDATE,
              });

            let currentTickets = ticketsAmount;

            if (tcksStage) {
                tcksStage.tickets = Number(tcksStage.tickets || 0) + ticketsAmount;
                currentTickets = tcksStage.tickets;
                await tcksStage.save({ transaction: t });
            } else {
                await TicketsMode.create(
                {
                    user: userId,
                    type:1,
                    mode: stageTicketMode,
                    tickets: ticketsAmount,
                },
                { transaction: t }
                );
            }

            return {
                message:`Has obtenido ${ticketsAmount} ticket(s) para ${stageInfo.name}`,
                success: true,
                last: Math.max(currentTickets - ticketsAmount, 0),
                curr: currentTickets,
            };
        } catch (error) {
            await t.rollback();
            console.error('Error al guardar tickets de stage:', error);
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

    getTestBagAmount(prize) {
        const [minStr, maxStr] = String(prize?.name || '').split('-');
        const min = parseInt(minStr, 10);
        const max = parseInt(maxStr, 10);

        if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        return Number(prize?.prize || 0);
    }

    buildTestPrizeResponse(typePrize, prize, prizeParams = null) {
        const amount = Number(prize?.prize || 0);
        const name = prize?.name || `Item ${amount}`;
        const days = prizeParams?.days ?? 2;

        switch (Number(typePrize)) {
            case 0:
            case 10:
            case 11:
            case 98:
            case 99:
                return { message: `Has obtenido un(a) ${name}`, success: true, testMode: true };
            case 1:
                return { message: `Has obtenido ${amount} de Oro`, success: true, last: 0, curr: 0, testMode: true };
            case 2:
                return { message: `Has obtenido ${amount} de Cash`, success: true, last: 0, curr: 0, testMode: true };
            case 3:
                return { message: `Has obtenido ${amount} ticket(s) de cash`, success: true, testMode: true };
            case 4:
                return { message: `Has obtenido ${amount} ticket(s) de oro`, success: true, testMode: true };
            case 5:
                return { message: `Has obtenido un(a) ${name} temporal (${String(days)} dias)`, success: true, testMode: true };
            case 6:
                return { message: `Has obtenido ${amount} dias de Power User`, success: true, last: 0, curr: 0, testMode: true };
            case 7:
            case 17:
                return { message: `Has obtenido ${amount} ticket(s) para theme park`, success: true, testMode: true };
            case 8: {
                const bagAmount = this.getTestBagAmount(prize);
                return { message: `Has obtenido ${bagAmount} de Oro de la Bolsa`, success: true, bv: bagAmount, last: 0, curr: 0, testMode: true };
            }
            case 9: {
                const bagAmount = this.getTestBagAmount(prize);
                return { message: `Has obtenido ${bagAmount} de Cash de la Bolsa`, success: true, bv: bagAmount, last: 0, curr: 0, testMode: true };
            }
            case 12:
                return { message: `Has obtenido ${amount} tickets de cash`, success: true, testMode: true };
            case 18:
                return { message: `Has obtenido ${amount} pica(s) de minar`, success: true, testMode: true };
            case 19:
                return { message: `Has obtenido ${amount} tickets de puntos`, success: true, testMode: true };
            default:
                return { success: false, code: '201', message: 'Tipo de premio no valido' };
        }
    }

    async setWinPrizes(game, typePrize, prize, userId, t, prizeParams = null, options = {}) {
        try {
            if (options.testMode) {
                return this.buildTestPrizeResponse(typePrize, prize, prizeParams);
            }

            // Agregar el premio según el tipo
            var response = null;
            const excludedPrizes = [10,11, 98, 99];
            // console.log(1);
            // console.log(typePrize);
            // console.log(prize);

            var regBolsa = 0;

            switch (typePrize) {
                case 0:
                    response = await this.saveItem(userId, prize, t, prizeParams);
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
                    response = await this.saveItemTemporal(userId, prize, t, prizeParams);
                    break;
                case 6:
                    response = await this.savePowerUser(userId,prize,t);
                    break;
                case 7:
                    // Ticket de Theme Park 1
                    response = await this.saveTicketsStages(userId,prize,t,1);
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
                    //ticket de cash
                    response = await this.saveGiroRuleta(userId,prize,t);
                    break;
                case 17:
                    // Ticket de Theme Park 2
                    response = await this.saveTicketsStages(userId,prize,t,2);
                    break;
                case 18:
                    // console.log(2);
                    response = await this.savePicaDeMina(userId,prize,t);
                    break;
                case 19:
                    // console.log(2);
                    //ticket de puntos
                    response = await this.saveTicketPuntos(userId,prize,t);
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

            if (!response?.success) {
                return response;
            }

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

    async eventLevelVerificator(game,opcion,username,transaction,prize, options = {}) {
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

                // En modo test solo se devuelve el estado visual al front.
                if (!options.testMode) {
                    match.premios_obtenidos = JSON.stringify(premiosObtenidos);
                    await match.save({ transaction });
                }

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
