import TrackingPacket from '../models/trackingPacketModel.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import Banlist from '../models/banListModel.js';
import sequelize from '../config/database.js';
import colors from "colors";

const EncryptFunction = async (str) => {
  let result = '';
  let i = 0;
  let j = str.length - 1;

  while (i <= j) {
    if (i <= j) {
      result += str[j];
      j--;
    }
    if (i <= j) {
      result += str[i];
      i++;
    }
  }

  return result;
};

const verifyPacketAndBan = async (user, user2, paramsString,verifyPacketEqual, t, req) => {
  let transaction;
    try {
        var userId;
        const transactionOption = t ? { transaction: t } : {};

        if(user === user2){
          userId = user;
        } else{
          const existUser = await UserGameInfo.findOne({
            where: {
              name: user,
            },
            ...transactionOption,
          });
          const existUser2 = await UserGameInfo.findOne({
            where: {
              name: user2,
            },
            ...transactionOption,
          });

          if(existUser){
            userId = user;
          } else if(existUser2){
            userId = user2
          }
        }

        // console.log("CHECK IF USER IS BAN:".blue,userId.yellow);

        const existingPacket = await TrackingPacket.findOne({
            attributes: ['user'],
            where: {
              packet: paramsString,
              user: userId,
            },
            ...transactionOption,
          });
      
          if (existingPacket || !verifyPacketEqual) {
            transaction = await sequelize.transaction();
            const userBan = (existingPacket ? existingPacket.user : userId); // Guardar el usuario asociado al paquete existente
            const clientIp = req.clientIp; 
            const reason = ((!verifyPacketEqual) ? "Modify an API data package" : "Repeated use of an API data package");
            const hwid = "00000000-00000000-00000000-00000000";

            // Insertar un nuevo registro en la tabla "banlist" en una transacción separada
            await Banlist.create({
              UserName: userBan, // Ajustar el campo apropiado de la tabla "banlist"
              HWID: hwid,
              UserIP: clientIp,
              Reason: reason,
            }, { transaction });

            // Modificar la tabla "usergameinfo" para cambiar el estado de la columna "ban" a 1 en la misma transacción
            await UserGameInfo.update(
                { ban: 1 },
                {
                    where: { name: userId },
                    transaction,
                }
            );

            await transaction.commit();

            return {
              success: false,
              code: '101',
              message: 'Has sido baneado por intentar enviar un paquete repetido o modificado a la API',
              userBan: userBan, // Devolver el usuario asociado al paquete existente en userBan
            };
          }
      
          return null; // Devolver null si el paquete no existe
      } catch (error) {
          if (transaction && !transaction.finished) {
              await transaction.rollback();
          }
          console.error(`Error al verificar y banear a usuario ${userId}:`, error);
          throw error;
    }
};

export { verifyPacketAndBan,EncryptFunction };
