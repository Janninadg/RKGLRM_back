
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
import AssetPrice from '../models/assetsPriceModel.js';
import TypeAsset from '../models/typeAssetsModel.js';
import AnunciosComment from '../models/anunciosCommentModel.js';
import StreamPlatform from '../models/streamsPlatformsModel.js';
import puppeteer from 'puppeteer'; // Importa Puppeteer
import axios from 'axios';
import StagesReset from '../models/stagesResetModel.js';

const IMG_OFF = "https://res.cloudinary.com/dgh0ctded/image/upload/f_auto,q_auto/afbhaox5bxrydq17t8ik";

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

  
      async getBuyAssets() {
        try {
            const assetsPrices = await AssetPrice.findAll({
              attributes:['id','asset','multiple','price','currency','img'],
              where:{
                show: 1,
              }
            });
      
            // Recorrer cada assetPrice y buscar su tipo en TypeAsset
            const assetsWithTypes = await Promise.all(
              assetsPrices.map(async (assetPrice) => {
                // Buscar el tipo correspondiente en TypeAsset
                const typeAsset = await TypeAsset.findOne({
                  where: { id: assetPrice.asset },
                  attributes: ['tipo'], // Obtener solo el campo 'tipo'
                });

                // Agregar el tipo al resultado
                return {
                  ...assetPrice.toJSON(),
                  tipo: typeAsset ? typeAsset.tipo : 'Tipo no encontrado',
                };
              })
            );

          return assetsWithTypes;
        } catch (error) {
          console.error('Error al obtener los assets y precios:', error);
          throw new Error('Error interno del servidor');
        }
      }

}

export default new WebService();