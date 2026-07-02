
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
import TokenSession from '../models/tokenSessionModel.js';
import UsersPanel from '../models/usersPanelModel.js';
import { generateRandomCoupon } from '../utils/utils.js';
import couponCache from '../modules/coupons/coupon.cache.js';

const STREAMER_ALLOWED_ITEMS = new Map([
  [12215, 'HP+1 100 ea'],
  [12272, 'AP+1 100 ea'],
  [12282, 'Chaos 100 ea'],
]);

const COUPON_PRIZE_TYPES = new Set([0, 1, 2]);

class StreamersService {
    async verifyIsStreamer(user) {
        try {
          const existGM = await Streamer.findOne({
            attributes:['id'],
            where:{
              user: user
            }
          });

          //console.log(existGM);

          return existGM ? 'true' : 'false';
        } catch (error) {
          throw new Error('Error al verificar si es Streamer');
        }
      }

    async setCupon(token,data,user,isDataIntegrityValid,paramsString, req) {
      const t = await sequelize.transaction();

      try {

        const verifyPacketEqual = (isDataIntegrityValid);
        const banInfo = await verifyPacketAndBan(user,user, paramsString, verifyPacketEqual, t, req);

        if (banInfo) {
          await t.rollback();
          return banInfo;
        }

        const trx = await sequelize.transaction();

        await TrackingPacket.create({
          packet: paramsString,
          user: user,
          fecha_uso: new Date(),
        }, { transaction: trx });

        await trx.commit();

        const sessionToken = await TokenSession.findOne({
          attributes: ['token'],
          where: { token: token, id: user },
          transaction: t,
        });

        if(!sessionToken){
          await t.rollback();
          return { success: false, code: '005', message: 'Token inválido...' };
        }

        let name = String(data._pn || '').trim();
        const limit = Number(data.lm);
        const prize = parseInt(data._prc,10);
        const tipoCupon = parseInt(data.sc,10);
        const rawType = Number(data._tc);
        const type = data.schema === 'streamer_reward_v2'
          ? rawType
          : (tipoCupon === 0 ? 2 : (rawType === 2 ? 0 : rawType + 1));
        const qty = Number(data.qty) || 1;

        if (qty > 1) {
          await t.rollback();
          return {
            success: false,
            code: '006',
            message: 'Solo puedes generar un cupón por solicitud.',
          };
        }

        if (!Number.isInteger(tipoCupon) || ![0, 1].includes(tipoCupon)) {
          await t.rollback();
          return {
            success: false,
            code: '007',
            message: 'Tipo de cupon invalido.',
          };
        }

        if (!Number.isInteger(type) || !COUPON_PRIZE_TYPES.has(type)) {
          await t.rollback();
          return {
            success: false,
            code: '007',
            message: 'Tipo de premio invalido.',
          };
        }

        if (!Number.isInteger(prize) || prize <= 0) {
          await t.rollback();
          return {
            success: false,
            code: '007',
            message: 'Premio invalido.',
          };
        }

        if (!Number.isInteger(limit) || limit <= 0) {
          await t.rollback();
          return {
            success: false,
            code: '007',
            message: 'El limite debe ser mayor a 0.',
          };
        }

        const existSt = await UsersPanel.findOne({
          attributes:['id'],
          where:{ user: user, type: 1 },
          transaction: t,
        });

        if(!existSt){
          await t.rollback();
          return { success:false, code:'001', message:'Ya no es Streamer' };
        }

        // validar item
        if(type === 0){
          const allowedItemName = STREAMER_ALLOWED_ITEMS.get(prize);

          if (!allowedItemName) {
            await t.rollback();
            return {
              success:false,
              code:'007',
              message:'No estas autorizado a generar cupon de este item',
            };
          }

          const itemData = await ItemInfo.findOne({
            attributes: ['type'],
            where: { id: prize },
            transaction: t,
          });

          if (!itemData) {
            await t.rollback();
            return { success:false, code:'003', message:'Item no existe' };
          }

          name = allowedItemName;
        } else if (!name) {
          await t.rollback();
          return {
            success:false,
            code:'007',
            message:'Debe ingresar un nombre de premio',
          };
        }

        if (tipoCupon === 0 && type === 2 && prize > 1500) {
          await t.rollback();
          return {
            success:false,
            code:'007',
            message:'La cantidad de Cash debe ser mayor a 0 y menor a 1500',
          };
        }

        // 🔥 VALIDAR LIMITE DIARIO
        const fechaActual = new Date();
        fechaActual.setHours(0, 0, 0, 0);

        const fechaFin = new Date();
        fechaFin.setHours(23, 59, 59, 999);

        const cuponesGenerados = await LogStream.count({
          where: {
            user: user,
            type: tipoCupon,
            date: { [Op.between]: [fechaActual, fechaFin] },
          },
          transaction: t
        });

        let limite;
        let codigoError = '005';
        let msg = '';

        switch (tipoCupon) {
          case 0:
            limite = 2;
            codigoError = '003';
            msg = 'No puedes generar más de 2 cupones para torneos en un día.';
            break;
          case 1:
            limite = 6;
            codigoError = '004';
            msg = 'No puedes generar más de 6 cupones para viewers en un día.';
            break;
        }

        if ((cuponesGenerados + qty) > limite) {
          await t.rollback();
          return { success:false, code:codigoError, message:msg };
        }

        // 🔥 GENERAR CUPONES
        const generatedCoupons = [];

        for (let i = 0; i < qty; i++) {
          generatedCoupons.push(generateRandomCoupon());
        }

        // 🔥 LOGS
        await LogStream.bulkCreate(
          generatedCoupons.map(c => ({
            action:'Generacion de cupon - ' + (type === 1 ? 'Gold' : (type===2 ? 'Cash' : 'Item')),
            user: user,
            prize: prize,
            type: tipoCupon,
            cupon: c,
            date: new Date(),
          })),
          { transaction: t }
        );

        // 🔥 CUPONES
        await Cupon.bulkCreate(
          generatedCoupons.map(c => ({
            name_prize: name,
            limite: limit,
            ticket: c,
            type: type,
            id_prize: prize,
            uri: '',
          })),
          { transaction: t }
        );

        await t.commit();

        // actualizar cache en memoria
        generatedCoupons.forEach((couponCode) => {
          couponCache.addOrUpdate({
            ticket: couponCode,
            name_prize: name,
            limite: limit,
            users: 0,
            type: type,
            id_prize: prize,
            uri: '',
          });
        });

        return {
          success: true,
          code: '000',
          message: `Se generaron ${generatedCoupons.length} cupones correctamente`,
          coupons: generatedCoupons
        };

      } catch (error) {
        await t.rollback();
        throw new Error('Error al generar cupon');
      }
    }

}

export default new StreamersService();
