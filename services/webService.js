
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

class WebService {
    async getLinks() {
        try {
            const links = await Linksgame.findAll({
                attributes: ['type','link','ref'],
                //raw: true,
                //transaction: t,
              });
      
          /**   CASE
              WHEN ci.lose = 0 AND ci.win = 0 THEN 1
              WHEN ci.lose = 0 AND ci.win > 0 THEN ci.win / 1
              WHEN ci.lose > 0 THEN ci.win / ci.lose
            END AS winrate*/
          return links;
        } catch (error) {
          console.error('Error al obtener los links:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async getAnuncios() {
        try {
            const anuncios = await Anuncio.findAll({
                where:{
                  estado:1,
                }
              });
      
          /**   CASE
              WHEN ci.lose = 0 AND ci.win = 0 THEN 1
              WHEN ci.lose = 0 AND ci.win > 0 THEN ci.win / 1
              WHEN ci.lose > 0 THEN ci.win / ci.lose
            END AS winrate*/
          return anuncios;
        } catch (error) {
          console.error('Error al obtener los anuncios:', error);
          throw new Error('Error interno del servidor');
        }
      }
}

export default new WebService();