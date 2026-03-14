
import { Sequelize,Op } from 'sequelize';
import sequelize from '../config/database.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import ItemInfo from '../models/itemInfoModel.js';
import TokenSession from '../models/tokenSessionModel.js';
import UserItemInfo from '../models/userItemInfoModel.js';
import ItemImage from '../models/itemImagesModel.js';
import UserAsset from '../models/userAssetsModel.js';
import ConfigParameters from '../models/configParametersModel.js';
import RefineryLog from '../models/refineryLogsModel.js';
import { enviarMensajeACliente, obtenerClientesActivos } from '../socket/socketServer.mjs';
import { getRemainingPowerTime, setClassName, setTypeName } from '../utils/prizesUtils.js';

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
                attributes: ['id','bag'],
                where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
                },
                // transaction: t, // Asociar la transacción con esta consulta
            });
            console.log(userGame.bag)
           // Obtener todos los items del usuario, ordenados por 'slot' y luego por 'id'
            const allUserItems = await UserItemInfo.findAll({
                attributes:['id','itemid','level','slot','exp','limittime'],
                where: {
                    userid: userGame.id,
                    characterid: 0,
                },
                order: [['slot', 'ASC'], ['id', 'ASC']], // Ordenar por 'slot' y luego por 'id'
                transaction: t,
            });

            // Revertir la transacción en caso de error
            // Revertir la transacción en caso de error o si no hay registros
            if (!allUserItems || allUserItems.length === 0) {
                // await t.rollback();
                return { success: true, code: '000', bag:userGame.bag, _ui: [] };
            }
            
            // Filtrar para obtener solo el primer item de cada slot
            const uniqueUserItems = allUserItems.reduce((acc, currentItem) => {
                // Verificar si ya existe un item con el mismo 'slot' en el array acumulador
                const existingItem = acc.find(item => item.slot === currentItem.slot);
                
                // Si no existe, agregar el item actual
                if (!existingItem) {
                    acc.push(currentItem);
                }
                
                return acc;
            }, []);

            // console.log(uniqueUserItems);

           // Obtener las imágenes de cada item y retornar solo los datos limpios
            const uniqueUserItemsWithImagesAndNames = await Promise.all(
                uniqueUserItems.map(async item => {
                    // Buscar la imagen en la tabla ItemImage
                    const itemImage = await ItemImage.findOne({
                        where: {
                            item: item.itemid // Suponiendo que 'id' es el identificador del item en uniqueUserItems
                        }
                    });
            //         console.log("ID: ",item.itemid);
            // console.log("OBJECT: ",itemImage);
            // console.log("IMAGE: ",itemImage.image);

                    // Buscar el nombre en la tabla ItemInfo basado en el itemid
                    const itemInfo = await ItemInfo.findOne({
                        where: {
                            id: item.itemid // Suponiendo que 'itemid' es el campo que corresponde al id en ItemInfo
                        }
                    });

                    const remainDays = await getRemainingPowerTime(item.limittime);

                    // Convertir el item a un objeto JSON y añadir el campo 'img' y 'name'
                    const itemData = item.toJSON();
                    const fullName = itemInfo ? itemInfo.name + setClassName(itemInfo.Class) : 'Unknown Item';
                    itemData.img = itemImage ? itemImage.image : '';
                    itemData.name = fullName;
                    itemData.remain = remainDays.days;
                    itemData.remText = remainDays.text;

                    return itemData;
                })
            );

            // const points = userPoints[0].Points;

            // console.log("FINAL :",uniqueUserItemsWithImagesAndNames);

            await t.commit(); // Confirmar la transacción
            return { success: true, code: '000', _ui: uniqueUserItemsWithImagesAndNames, bag: userGame.bag };

        } catch (error) {
            await t.rollback();
            console.error('Error al obtener puntos de evento:', error);
            throw new Error('Error interno del servidor');
        }
    }

    async refinyItem(user,token,assetid,idi,slot,itemid) {
        const t = await sequelize.transaction(); // Iniciar una transacción
        
        try {

            return { success: false, code: '200', message: 'Refinería no disponible temporalmente' };

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
                console.log('[ERROR]'.red,'Sesión antigua'.red);
                return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para refinar.' };
            }

            /** Verificador de juego activo aún no... */
            // const gameActive = await GameActive.findOne({
            //     where: {
            //         user: user, // Cambia esto para usar el nombre de usuario correcto
            //     },
            //     transaction: t, // Asociar la transacción con esta consulta
            //     lock: t.LOCK.UPDATE,
            // });

            // if (gameActive && gameActive.active === 1){
            //     await t.rollback(); // Revertir la transacción en caso de error
            //     console.log('[ERROR]'.red,'Jugando dentro de rakion actualmente'.red);
            //     return { success: false, code: '200', message: 'No puedes refinar mientrás te encuentres jugando en el servidor.' };
            // }

            // const res = await this.socketSend(user);

            // if(!res.success && res.code==='999'){
            //     await t.rollback(); 
            //     return res;
            // }

            // if(res.success && Number(res.obj.reason)===0 && user === res.obj.user){
            //     await t.rollback(); 
            //     console.log("[Error] Intenta refinar un item mientras esta jugando.".red);
            //     return { success: false, code: '200', message: 'No puedes refinar mientras estes en el juego. Cierra sesión en el launcher.' };
            // }

            const userGame = await UserGameInfo.findOne({
                attributes: ['id'],
                where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
            });

            // Comprobar si el item le pertenece actualmente al usuario...
            const itemUser = await UserItemInfo.findOne({
                where: {
                    id: idi,
                    userid: userGame.id, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
                lock: t.LOCK.UPDATE,
            });
          
            
            if (!itemUser){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'El identificador del item no le pertenece al usuario actual'.blue);
                return { success: false, code: '200', message: 'El identificador de tu item en el inventario no te pertenece o ha cambiado. Por favor, actualiza la página.' };
            }

            if (itemUser && itemid !== itemUser.itemid){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'El identificador del item no coincide con el item a refinar'.blue);
                return { success: false, code: '200', message: 'El identificador de tu item en el inventario no coincide con el item que deseas refinar. Por favor, actualiza la página.' };
            }

            if (itemUser && slot !== itemUser.slot){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'El item no se encuentra en el slot actual'.blue);
                return { success: false, code: '200', message: 'Tu item en el inventario no coincide con el slot actual. Por favor, actualiza la página.' };
            }

            if (itemUser && itemUser.characterid !== 0){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'El item está en un personaje'.blue);
                return { success: false, code: '200', message: 'Tu item está en un personaje, devuelvelo al inventario para poder refinarlo.' };
            }

            const typeNotRef = [9,10,11,12,13,14];

            // Comprobar si el item le pertenece actualmente al usuario...
            const itemType = await ItemInfo.findOne({
                where: {
                    // id: idi,
                    id: itemUser.itemid, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
                lock: t.LOCK.UPDATE,
            });

            if(itemType.type === 8 && assetid == 2){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'Intento refinar criaturas con piedra de oro'.blue);
                return { success: false, code: '100', message: 'Esta piedra solo puede ser usada con items (NO criaturas).' };
            }

             if(itemType.type !== 8 && assetid == 2 && itemUser.level >= 4){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'Intento de refinar items de nivel +4 con piedra de oro'.blue);
                return { success: false, code: '100', message: 'Solo puedes usar esta piedra para refinar items hasta el nivel 4.' };
            }

             if(itemType.type !== 8 && assetid == 1 && itemUser.level < 4){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'Intento de refinar items de nivel menor a 4 con piedra de cash'.blue);
                return { success: false, code: '100', message: 'Solo puedes usar esta piedra para refinar items con nivel mayor a 4.' };
            }


            if (itemUser && typeNotRef.includes(itemType.type)){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'Este tipo de item no se puede refinar'.blue);
                const typeName = setTypeName(itemType.type);
                return { success: false, code: '100', message: 'Este tipo de item no se puede refinar (Tipo : '+ typeName +').' };
            }

            const maxLevelCreatures = await ConfigParameters.findOne({
                where: {
                name: 'max_ref_creatures'
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            const maxLevelItems= await ConfigParameters.findOne({
                where: {
                name: 'max_ref_items'
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            const maxLvlCreatures = parseInt(maxLevelCreatures.value);
            const maxLvlItems = parseInt(maxLevelItems.value);
            
            // console.log(itemType.type)
            //   console.log(itemUser)
            if (itemType.type === 8 && itemUser.level >= maxLvlCreatures){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'La criatura llegó al nivel máximo de refinería'.blue);
                return { success: false, code: '100', message: 'Tu criatura ya no se puede refinar porque alcanzó el nivel máximo a refinar (Lvl. '+maxLvlCreatures+').' };
            }

            if (itemType.type !== 8 && itemUser.level >= maxLvlItems){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[INFO]'.blue,'El item llegó al nivel máximo de refinería'.blue);
                return { success: false, code: '100', message: 'Tu item ya no se puede refinar porque alcanzó el nivel máximo a refinar (Lvl. '+maxLvlItems+').' };
            }

            // if(assetid === 2) {
            //    await t.rollback(); // Revertir la transacción en caso de error
            //     console.log('[INFO]'.blue,'Piedra de oro no disponible'.blue);
            //     return { success: false, code: '100', message: 'Ya no está disponible la refinería con piedras de oro' };
            // }
            
            // Verificar si tiene suficientes piedras a refinar....
            const userAsset = await UserAsset.findOne({
                where: {
                  user: user,
                  asset: assetid,
                },
                transaction: t, // Asociar la transacción con esta consulta
                lock: t.LOCK.UPDATE,
            });

            if (!userAsset || userAsset.amount <= 0){
                await t.rollback(); // Revertir la transacción en caso de error
                console.log('[ERROR]'.red,'Cantidad insuficiente de piedras para refinar'.red);
                return { success: false, code: '200', message: 'No tienes suficiente cantidad de este tipo de piedra para refinar' };
            }

            // Luego de verificar coincidencias ... Probabilidad de refinación:

            const refineryProbs = await ConfigParameters.findOne({
                where: {
                name: 'refineryprobs1'
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });
            
            const refineryProbsUp = await ConfigParameters.findOne({
                where: {
                name: 'refineryprobsup1'
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            const refineryProbs2 = await ConfigParameters.findOne({
                where: {
                name: 'refineryprobs2'
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            const refineryProbsUp2 = await ConfigParameters.findOne({
                where: {
                name: 'refineryprobsup2'
                },
                transaction: t,
                lock: t.LOCK.UPDATE
            });

            // Convertir los valores a JSON
            const refineryProbsValues = JSON.parse(refineryProbs.value);
            const refineryProbsUpValues = JSON.parse(refineryProbsUp.value);
            const refineryProbs2Values = JSON.parse(refineryProbs2.value);
            const refineryProbsUp2Values = JSON.parse(refineryProbsUp2.value);

            // Obtener el día actual (en hora Perú UTC-5)
            const currentDate = new Date();
            const peruTimezoneOffset = -5; // UTC-5
            const peruTime = new Date(currentDate.getTime() + peruTimezoneOffset * 60 * 60 * 1000);
            const currentDay = peruTime.getUTCDay(); // 0 es Domingo, 1 es Lunes, etc.

            // Definir qué probabilidades usar según el día
            let selectedRefineryProbs;
            // let normalDays;

            if ((currentDay >= 1 && currentDay <= 4)) {
                // De lunes a jueves
                selectedRefineryProbs = assetid === 1 ? refineryProbsValues : refineryProbs2Values;
            } else if (currentDay >= 5 || currentDay === 0) {
            // } else {
                // De viernes a domingo (o domingo)
                selectedRefineryProbs = assetid === 1 ? refineryProbsUpValues : refineryProbsUp2Values;
            }

            // Realizar el calculo de probabilidad:
            const randomProb = Math.random();
            let cumulativeProb = 0;
            let selectedIndex = 0;
            // const probabilities = [0.4,0.3,0.3,0.3]; // Luego cambiar en la base de datos

            for (let i = 0; i < selectedRefineryProbs.length; i++) {
                cumulativeProb += selectedRefineryProbs[i];
                if (randomProb <= cumulativeProb) {
                  selectedIndex = i;
                  break;
                }
            }

            // console.log(selectedRefineryProbs);

            // console.log(selectedIndex);

            userAsset.amount -= 1;
            await userAsset.save({ transaction: t });
             // Agregar log de refinación antes del commit

            let item = itemUser.itemid;
            let lvl = itemUser.level;


            let success = true;
            let message = '¡Tu item se ha refinado con éxito!';
            let code = '000';

            switch (selectedIndex) {
                case 0:
                    // Gano +1 level
                    itemUser.level += 1;
                    await itemUser.save({ transaction: t });
                    lvl = itemUser.level;
                    console.log('[EXITO]'.green,'Refinería exitosa'.green);
                    break;
                case 1:
                    // Perdio la piedra, no refino
                    success = false;
                    message = 'La refinería de tu item fracasó. Inténtalo nuevamente.';
                    code = '100';

                    console.log('[ERROR]'.red,'Fracasó la refinería'.red);
                    break;
                case 2:
                    // Perdio la piedra y -1 level
                    if(itemUser.level >= 1){
                        itemUser.level -= 1;
                        await itemUser.save({ transaction: t });
                    }

                    lvl = itemUser.level;

                    success = false;
                    message = 'La refinería de tu item fracasó y bajo un nivel. Inténtalo nuevamente.';
                    code = '100';
                    console.log('[ERROR]'.red,'Fracasó la refinería, bajo de nivel de tu item'.red);
                    break;
                case 3:
                    // Perdio la piedra y el item.... ups
           
                    success = false;
                    message = 'La refinería de tu item fracasó y lo perdiste.';
                    console.log('[ERROR]'.red,'Fracasó la refinería, perdiste tu item'.red);
                    code = '300';

                    // Eliminar el ítem dentro de la misma transacción
                    await UserItemInfo.destroy({
                        where: { id: itemUser.id },
                        transaction: t // Asegura que la eliminación sea parte de la transacción
                    });

                    break;
                default:
                    break;
            } 

            await RefineryLog.create({
                user: user,  // ID del usuario
                itemid: item,  // ID del ítem refinado
                currentlevel: lvl,  // Nivel actual después del refinado
                refinerystate: selectedIndex,  // Estado del refinado (éxito, falla, etc.)
                typeasset: assetid,  // Tipo de piedra usada para refinar
                fecha: new Date(),  // Fecha actual
            }, { transaction: t });

            await t.commit();
            return { success, code ,message };

        } catch (error) {
            await t.rollback();
            console.error('Error al refinar:', error);
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
                    message: 'El servidor no puede realizar la comprobación para la refineria. Contacta con el administrador.'
                  };
                  // Maneja el error o lanza una excepción
                }
            } else {
                console.log("!![Server] No hay clientes activos para enviar mensajes.".red);
                // console.log("!![Server]".blue,' No se pudo enviar el mensaje porque no hay clientes activos.'.blue);
                return {
                  success: false,
                  code: '999',
                  message: 'Servidor inactivo, no se puede realizar la comprobación para la refineria. Contacta con el administrador.'
                };
            }
    
          const response = JSON.parse(res);
          console.log("[Object Received] ".magenta, response);
          return {success:true,obj:response};
        } catch (errorObj) {
          console.error("Error al enviar mensaje:", errorObj);
          // return errorObj;  // Devuelves el error estándar que tú mismo preparaste
          console.log("!![Server] El servidor no puede realizar la comprobación para la refineria.".red);
          if(errorObj.code && errorObj.code==='999'){
              return errorObj;
          } else{
              return {
                  success: false,
                  code: '999',
                  message: 'El servidor no puede realizar la comprobación para la refineria. Contacta con el administrador.'
                };
          }

      }
      }
}

export default new RefineriaService();