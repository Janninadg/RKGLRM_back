
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
import Streamer from '../models/streamers.js';
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

class RefineriaService {

    async getInventory(user,token) {
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

            const userGame = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
                },
                // transaction: t, // Asociar la transacción con esta consulta
            });

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
            const userItems = await UserItemInfo.findAll({
                where: {
                    userid: userGame.id
                },
                order: [['slot', 'ASC']], // Ordenar por el campo 'slot' de manera ascendente
                transaction: t,
            });

            // Revertir la transacción en caso de error
            // Revertir la transacción en caso de error o si no hay registros
            if (!userItems || userItems.length === 0) {
                // await t.rollback();
                return { success: true, code: '000', ep: 0, _ui: [] };
            }

            // const points = userPoints[0].Points;

            await t.commit(); // Confirmar la transacción
            return { success: true, code: '000', _ui: userItems };

        } catch (error) {
            await t.rollback();
            console.error('Error al obtener puntos de evento:', error);
            throw new Error('Error interno del servidor');
        }
    }
}

export default new RefineriaService();