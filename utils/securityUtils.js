import TrackingPacket from '../models/trackingPacketModel.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import Banlist from '../models/banListModel.js';
import sequelize from '../config/database.js';
import colors from "colors";

const verifyPacketAndBan = async (user, user2, paramsString,verifyPacketEqual, t, req) => {
  let transaction;
    try {
        transaction = await sequelize.transaction();
        var userId;

        if(user === user2){
          userId = user;
        } else{
          const existUser = await UserGameInfo.findOne({
            where: {
              name: user,
            },
            transaction: t,
          });
          const existUser2 = await UserGameInfo.findOne({
            where: {
              name: user2,
            },
            transaction: t,
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
            transaction: t, // Asociar la transacción con esta consulta
          });
      
          if (existingPacket || !verifyPacketEqual) {
            const userBan = (existingPacket ? existingPacket.user : userId); // Guardar el usuario asociado al paquete existente
            const clientIp = req.clientIp; 
            const reason = ((!verifyPacketEqual) ? "Modify an API data package" : "Repeated use of an API data package");
            const hwid = "00000000-00000000-00000000-00000000";

            // Insertar un nuevo registro en la tabla "banlist" en una transacción separada
            await Banlist.create({
              UserID: userBan, // Ajustar el campo apropiado de la tabla "banlist"
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
          if (transaction) {
              await transaction.rollback();
          }
          console.error(`Error al verificar y banear a usuario ${userId}:`, error);
          throw error;
    }
};

export { verifyPacketAndBan,EncryptFunction };
