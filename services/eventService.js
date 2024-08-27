import Ticket from '../models/ticketsModel.js';
import Cash from '../models/cashModel.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import PendingPresents from '../models/pendingPresentsModel.js';
import TempPrize from '../models/tempPrizes.js'
import PrizesGame from '../models/prizesGamesModel.js';
import { Sequelize, useInflection } from 'sequelize';
import sequelize from '../config/database.js';
import { verifyPacketAndBan } from '../utils/securityUtils.js';
import { encrypt,generateKey } from '../helpers/encryption.js';
import TicketOro from '../models/ticketsOroModel.js';
import User from '../models/userModel.js';
import UserItemInfo from '../models/userItemInfoModel.js';
import TempCupon from '../models/tempCupones.js';
import Cupon from '../models/cuponesModel.js';
import { calculatePowerUse, getAmountItem } from '../utils/prizesUtils.js';
import TokenSession from '../models/tokenSessionModel.js';
//import EventTickets from '../models/eventTicketsModel.js';
import TicketsMode from '../models/ticketsModeModel.js';
import ItemInfo from '../models/itemInfoModel.js';
import UserPoisons from '../models/userPoisonsModel.js';
import GameAuth from '../models/gameAuthModel.js';
import { generateRandomToken } from '../utils/authUtils.js';
import PumpkinsAuth from '../models/calabazasAuthModel.js';
import HotslotAuth from '../models/hotSlotAuthModel.js';
import SetItem from '../models/setItemsModel.js';
import Evento from '../models/eventosModel.js';
import LogRewardsUser from '../models/logRewardUserModel.js';
import gamesService from './gamesService.js';
import CharacterInfo from '../models/characterInfo.js';
import EventLevelCharacter from '../models/eventLevelChModel.js';
import Matches from '../models/matchesModel.js';
import TrackingPacket from '../models/trackingPacketModel.js';
import EventPoint from '../models/eventPointsModel.js';
import colors from "colors";

class EventService {
  async verifyUserTickets(userId) {
    try {
      const userTicket = await Ticket.findOne({
      attributes: ['tickets'],
          where: {
              id: userId,
          },
      });

      return userTicket ? (userTicket.tickets >= 1 ? '000' : '100') : null;
    } catch (error) {
      console.error('Error al verificar los tickets del usuario:', error);
      throw new Error('Error en el servidor');
    }
  }

  async getTickets(userId) {
    try {
      const userTicket = await Ticket.findOne({
      attributes: ['tickets','id'],
          where: {
              id: userId,
          },
      });

      const userTicketOro = await TicketOro.findOne({
        attributes: ['tickets','id'],
            where: {
                id: userId,
            },
        });
  

      return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }

 /* async getTicketsEvents(userId,event) {
    try {
      const userTicket = await EventTickets.findOne({
      attributes: ['tickets','user'],
          where: {
              user: userId,
              event: event,
          },
      });

      return userTicket ? {tickets: userTicket.tickets} : {tickets:0};
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }*/

  async decreaseTickets(token,typet,user,isDataIntegrityValid,paramsString, req) {
    const t = await sequelize.transaction();
    try {
      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid);// && (userId === userId2) && ((ticketCount+operator) === resOp) && (ticketCount === ticketCount2) && (key1 === key2);
      const banInfo = await verifyPacketAndBan(user,user, paramsString, verifyPacketEqual, t, req);
      console.log(banInfo);
      if (banInfo) {
        await t.rollback(); // Revertir la transacción en caso de error
        return banInfo;
      }
  
      const trx = await sequelize.transaction();
      // Si la cadena de parámetros no existe, insertarla en trackingpacket
      await TrackingPacket.create(
        {
          packet: paramsString,
          user: user,
          fecha_uso: new Date(),
        },
        {
          transaction: trx, // Asociar la transacción con esta operación
        }
      );

      await trx.commit();

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
        return { success: false, code: '005', message: 'Token inválido o sesión antigua para este evento...' };
      }
      
      var type;

      switch (typet) {
        case 'topdm33':
          type = 2;
          break;
        case 'gmypd64':
          type = 1;
          break;
        default:
          break;
      }

      switch (type) {
        case 1:

          const userTicketsGold = await TicketOro.findOne({
            attributes: ['tickets'],
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          // Revertir la transacción en caso de error
          if(!userTicketsGold || userTicketsGold.tickets < 1){
            await t.rollback();
            return { success: false, code: '001', message:`No tiene tickets suficientes para usarlos en este evento. Refresca la página...` };
          }

           // Decrementar el ticket del usuario
           await TicketOro.decrement('tickets', {
            by: 1,
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta operación
          });

          const NewUserTicketsGold = await TicketOro.findOne({
            attributes: ['tickets'],
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });


          await t.commit();

          return NewUserTicketsGold ? {success:true,code: '000',nto: NewUserTicketsGold.tickets} : {success:true,code: '000',nto:0};
          
          break;
        case 2:
          
          const userTickets = await Ticket.findOne({
            attributes: ['tickets'],
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          // Revertir la transacción en caso de error
          if(!userTickets || userTickets.tickets < 1){
            await t.rollback();
            return { success: false, code: '001', message:`No tiene tickets suficientes para jugar en este evento. Refresca la página...` };
          }

          // Decrementar el ticket del usuario
          await Ticket.decrement('tickets', {
            by: 1,
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta operación
          });

          const NewUserTickets = await Ticket.findOne({
            attributes: ['tickets'],
            where: {
              id: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });


          await t.commit();

          return NewUserTickets ? {success:true,code: '000',ntc:NewUserTickets.tickets} : {success:true,code: '000',ntc:0};
          break;
      
        default:
          await t.rollback();
            return { success: false, code: '002', message:`No existe este tipo de tickets` };
          break;
      }

    } catch (error) {
      await t.rollback();
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }

  async setPartida(authGame,token,type,index,user,estado,isDataIntegrityValid,paramsString, req) {
    const t = await sequelize.transaction();
    try {
      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid);// && (userId === userId2) && ((ticketCount+operator) === resOp) && (ticketCount === ticketCount2) && (key1 === key2);
      const banInfo = await verifyPacketAndBan(user,user, paramsString, verifyPacketEqual, t, req);
      console.log(banInfo);
      if (banInfo) {
        await t.rollback(); // Revertir la transacción en caso de error
        return banInfo;
      }
  
      const trx = await sequelize.transaction();
      // Si la cadena de parámetros no existe, insertarla en trackingpacket
      await TrackingPacket.create(
        {
          packet: paramsString,
          user: user,
          fecha_uso: new Date(),
        },
        {
          transaction: trx, // Asociar la transacción con esta operación
        }
      );

      await trx.commit();

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
        return { success: false, code: '100', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      switch (estado) {
        case 0:
          // Eliminar partida:
          await Matches.update(
            { estado: 0}, //cambiar a codigo_base
            { where: { user: user, estado:1, game:type },
              transaction: t 
            },
          );

          await t.commit();
          return {success:true,code:'000'}

          break;
      
        case 1:
          // Crear o actualizar partida:
          const matchFound = await Matches.findOne({
            where: {
              user:user,
              estado:1,
              game: type,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });
          //console.log('AAAA');


          switch (type) {
            case 3:
              // Verifico token...
              const tokenCount = await PumpkinsAuth.findOne({
                attributes: ['token'],
                where: {
                  token: authGame,
                  user: user,
                },
                transaction: t, // Asociar la transacción con esta consulta
              });

              if(!tokenCount){
                await t.rollback(); // Revertir la transacción en caso de error
                return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
              }

              if(!matchFound){

                // Creo una nueva partida...

                await Matches.create(
                  {
                    user: user,
                    calabazas: JSON.stringify([...Array(15).fill({ premio: null, presionada: false })]),
                    premios:JSON.stringify([]),
                    picked:String(0),
                    nombres:JSON.stringify([]),
                    game:type,
                  },
                  {
                    transaction: t, // Asociar la transacción con esta operación
                  }
                );

                await t.commit();
                return {success:true,code:'000'};
              }

              // Actualizo partida...

              //Verificar cantidad de tickets gastados:
              const numGames = await Matches.findAll({
                //attributes: [[Sequelize.fn('COUNT', Sequelize.literal('DISTINCT slot')), 'slots']],
                //group: ['name'],
                where: {
                  user: user,
                  game: 3,
                },
                transaction: t, // Asociar la transacción con esta consulta
              });

              const numWins = await TempPrize.findAll({
                //attributes: [[Sequelize.fn('COUNT', Sequelize.literal('DISTINCT slot')), 'slots']],
                //group: ['name'],
                where: {
                  user: user,
                  game: 3,
                  prize: 8007, //Toro
                },
                transaction: t, // Asociar la transacción con esta consulta
              });


              //console.log(numGames.length);
              //console.log(numWins.length);

              const probabilidades = [];

              if(numWins.length == 0 && numGames > 80){
                probabilidades.push(1, 1, 0.9, 0.80,0.60,0.40);
              } else{
                probabilidades.push(1, 0.98, 0.80, 0.60,0.40,0.15);
              }
              
              //console.log(probabilidades);
              //const probabilidades = [1, 1, 1, 1,1,1];

              //const index = 0; //luego vendra del front es la calabaza presionada por defecto 0

              const setcalabazas = JSON.parse(matchFound.calabazas);
              const setpremios = JSON.parse(matchFound.premios);
              const setnombres = JSON.parse(matchFound.nombres);

              let nuevasCalabazas = [...setcalabazas];
              let nuevosPremios = [...setpremios];
              let nuevosNombres = [...setnombres];

              if (Math.random() < probabilidades[Number(matchFound.picked)]){
                const dataPr = await this.getAllPrizes(type,t);
                //console.log(dataPr);
                const prizes = [];

                // Recorrer el arreglo dataPr y construir probs y data
                let i = 0;
                while(i < dataPr.length){
                  const newDataPrize = [];
                  let sumprob = 0;
      
                  do {
      
                    const newItem = {
                      id: dataPr[i].orderPrize,
                      name: dataPr[i].name,
                      url: dataPr[i].url,
                      prob: dataPr[i].probability,
                    };
      
                    sumprob += dataPr[i].probability;
      
                    newDataPrize.push(newItem);
                    i += 1;
      
                  } while (sumprob < 1);
      
                  prizes.push(newDataPrize);
      
                  //i += 1;
                }

                nuevasCalabazas[index] = {
                  ...setcalabazas[index],
                  presionada: true,
                };

                const randomProb = Math.random();
                var premioIndex;
                let cumulativeProb = 0;

                //console.log(prizes);

                for (let i = 0; i < prizes[Number(matchFound.picked)].length; i++) {
                  cumulativeProb += prizes[Number(matchFound.picked)][i].prob;
                  if (randomProb <= cumulativeProb) {
                    premioIndex = i;
                    break;
                  }
                }

                const premio = prizes[Number(matchFound.picked)][premioIndex].name;
                const id = prizes[Number(matchFound.picked)][premioIndex].id;
                const premioUrl = prizes[Number(matchFound.picked)][premioIndex].url;

                nuevasCalabazas[index].premio = premio;
                nuevosPremios = [...setpremios, id];
                nuevosNombres = [...setnombres, premio];
                nuevasCalabazas[index].premioUrl = premioUrl;

                //console.log('BBB');
                await Matches.update(
                  { calabazas: JSON.stringify(nuevasCalabazas),
                    premios:JSON.stringify(nuevosPremios),
                    picked:String(Number(matchFound.picked)+1),
                    nombres:JSON.stringify(nuevosNombres),
                  }, //cambiar a codigo_base
                  { where: { user: user,estado:1,game:type, },
                    transaction: t 
                  },
                );
                //console.log('CCCC');

                var ix = Number(matchFound.picked)+1;
                await t.commit();
                return {success:true,code:'003',xc:false,_om2:nuevasCalabazas,_om3:nuevosPremios,_om4:nuevosNombres,_om5:ix };

              } else {
                nuevasCalabazas[index].premio = '¡Explotó!';
                nuevasCalabazas[index].premioUrl = '/pictures/extra/xmaslose.gif';
                var ix = Number(matchFound.picked)+1;
                await t.commit();
                return {success:true,code:'003',xc:true,_om2:nuevasCalabazas,_om3:nuevosPremios,_om4:nuevosNombres,_om5:ix };
              }

              break;
            case 4:
              //Cerrar nuevo juego...:
              await t.rollback(); // Revertir la transacción en caso de error
              return { success: false, code: '301', message: 'El juego ya no está disponible...' };

              // Verifico token...
              const tokenHot = await HotslotAuth.findOne({
                attributes: ['token'],
                where: {
                  token: authGame,
                  user: user,
                },
                transaction: t, // Asociar la transacción con esta consulta
              });

              if(!tokenHot){
                await t.rollback(); // Revertir la transacción en caso de error
                return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
              }

              if(!matchFound){

                //Decrementar tickets:
                const userTickets = await Ticket.findOne({
                  attributes: ['tickets'],
                  where: {
                    id: user,
                  },
                  transaction: t, // Asociar la transacción con esta consulta
                });
      
                // Revertir la transacción en caso de error
                if(!userTickets || (userTickets && userTickets.tickets < 1)){
                  await t.rollback();
                  return { success: false, code: '001', message:`No tiene tickets suficientes para jugar en este evento. Refresca la página...` };
                }
      
                // Decrementar el ticket del usuario
                await Ticket.decrement('tickets', {
                  by: 1,
                  where: {
                    id: user,
                  },
                  transaction: t, // Asociar la transacción con esta operación
                });
      
                const NewUserTickets = await Ticket.findOne({
                  attributes: ['tickets'],
                  where: {
                    id: user,
                  },
                  transaction: t, // Asociar la transacción con esta consulta
                });

                if(Math.random() < 0.6){
                  //Pierdes :)
                  await t.commit();
                  return {success:true,code:'003',xc:false,message:'¡Perdiste! Mejor suerte para la próxima...',ntc:NewUserTickets.tickets };
                }
                else{

                  const dataPr2 = await this.getAllPrizes(type,t);

                  const randomProb = Math.random();
                  var premioIndex;
                  let cumulativeProb = 0;
  
                  //console.log(prizes);
  
                  for (let i = 0; i < dataPr2.length; i++) {
                    cumulativeProb += dataPr2[i].probability;
                    if (randomProb <= cumulativeProb) {
                      premioIndex = i;
                      break;
                    }
                  }

                  var newPr = [];
                  var newNo = [];
                  newPr.push(premioIndex+1);
                  newNo.push(dataPr2[premioIndex].name);

                  const arr1 = [6,7,8,9];
                  var valNext = false;
  
                  var message;

                  if(newPr.length === 1  && arr1.includes(newPr[0]-1)){
                    valNext = true;
                    message = `Reclama tu(s) premio(s):  (${newNo.join(', ')}) o arriésgate y gira nuevamente...`;
                  } else if(newPr.length === 1 && !arr1.includes(premioIndex)){
                    valNext = false;
                    message = `Reclama tu(s) premio(s):  (${newNo.join(', ')})`;
                  } else{
                    await t.rollback(); 
                    return { success: false, code: '001', message: 'No puedes obtener más premios' };
                  }

                  // Creo una nueva partida...

                  await Matches.create(
                    {
                      user: user,
                      calabazas: JSON.stringify([]),
                      premios:JSON.stringify(newPr),
                      picked:String(0),
                      nombres:JSON.stringify(newNo),
                      game:type,
                    },
                    {
                      transaction: t, // Asociar la transacción con esta operación
                    }
                  );

                  await t.commit();
                  return {success:true,code:'003',xc:true,_om2:newNo,_om3:newPr,_om4:valNext,message,ntc:NewUserTickets.tickets };
                }
                
              }

              // Actualizo partida...

              const premioIn = JSON.parse(matchFound.premios);
              const premioName = JSON.parse(matchFound.nombres);

              let newPremios = [...premioIn];
              let newNombres = [...premioName];
              const arr = [6,7,8,9];

              if(Math.random() < 0.6){

                // Eliminar partida:
                await Matches.update(
                  { estado: 0}, //cambiar a codigo_base
                  { where: { user: user, estado:1, game:type },
                    transaction: t 
                  },
                );

                if(premioIn.length === 1  && arr.includes(premioIn[0]-1)){
                  // retornar 400 de cash

                  // Actualizar el cash en Cash
                  await Cash.increment(
                    'cash',
                    { by: 400, where: { id: user }, transaction: t }
                  );

                  await t.commit();
                  return {success:true,code:'003',xc:false,message:'Perdiste todos tus premios, pero se te retonó la mitad del valor del ticket...' };
                }

                //Pierdes :)
                await t.commit();
                return {success:true,code:'003',xc:false,message:'¡Perdiste! Mejor suerte para la próxima...' };

              } else{
                const dataPr = await this.getAllPrizes(type,t);

                const randomProb = Math.random();
                var premioIndex;
                let cumulativeProb = 0;

                //console.log(prizes);

                for (let i = 0; i < dataPr.length; i++) {
                  cumulativeProb += dataPr[i].probability;
                  if (randomProb <= cumulativeProb) {
                    premioIndex = i;
                    break;
                  }
                }
                
                var valNext = false;

                newPremios = [...premioIn, premioIndex+1];
                newNombres = [...premioName, dataPr[premioIndex].name];
                var message;

                if((premioIn.length === 1  && arr.includes(premioIn[0]-1)) ){
                  valNext = false;
                  message = `Reclama tu(s) premio(s):  (${newNombres.join(', ')})`;
                } else{
                  await t.rollback(); 
                  return { success: false, code: '001', message: 'No puedes obtener más premios' };
                }

                await Matches.update(
                  { premios:JSON.stringify(newPremios),
                    nombres:JSON.stringify(newNombres),
                  }, //cambiar a codigo_base
                  { where: { user: user,estado:1,game:type },
                    transaction: t 
                  },
                );

                await t.commit();
                return {success:true,code:'003',xc:true,_om2:newNombres,_om3:newPremios,_om4:valNext,message };

              }

              break;
            default:
              await t.rollback(); 
              return { success: false, code: '001', message: 'No existe este tipo de juego' };
              break;
          }

          break;
        case 2:
          
          //Obtener partida en curso
          const match = await Matches.findOne({
            attributes: ['calabazas','premios','picked','nombres'],
            where: {
              user:user,
              estado:1,
              game: type,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          const tokenGen = generateRandomToken();

          
          switch (type) {
            case 3:
              const pumpAuth = await PumpkinsAuth.findOne({
                where: {
                  user: user, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
              });
    
              if(!pumpAuth){
                await PumpkinsAuth.create(
                  {
                    user: user,
                    token: tokenGen,
                    date: new Date(),
                  },
                  {
                    transaction: t, // Asociar la transacción con esta operación
                  }
                );
              } else{
                await PumpkinsAuth.update(
                  { date: new Date(),
                    token: tokenGen,
                  },
                  {
                      where: { user: user },
                      transaction: t,
                  }
                );
              }

              if(!match){
                await t.commit();
                return {success:true,code:'000',_authg:tokenGen};
              }
    
              await t.commit();
              return {success:true,code:'002',_msv:match,message:'Tienes una partida en curso...',_authg:tokenGen};
              break;
            case 4:
              const slotAuth = await HotslotAuth.findOne({
                where: {
                  user: user, // Cambia esto para usar el nombre de usuario correcto
                },
                transaction: t, // Asociar la transacción con esta consulta
              });
    
              if(!slotAuth){
                await HotslotAuth.create(
                  {
                    user: user,
                    token: tokenGen,
                    date: new Date(),
                  },
                  {
                    transaction: t, // Asociar la transacción con esta operación
                  }
                );
              } else{
                await HotslotAuth.update(
                  { date: new Date(),
                    token: tokenGen,
                  },
                  {
                      where: { user: user },
                      transaction: t,
                  }
                );
              }


              if(!match){
                await t.commit();
                return {success:true,code:'000',_authg:tokenGen};
              }

              var message;
              var valNext=false;
              var arr3 = [6,7,8,9];

              var prem = JSON.parse(match.premios);
              var nom = JSON.parse(match.nombres);
    
              if(prem.length === 2){
                valNext = false;
                message = `Reclama tus premios prendientes:  (${nom.join(', ')})`;
              } else if(prem.length === 1 && arr3.includes(prem[0]-1)){
                valNext = true;
                message = `Reclama tu premio prendiente:  (${nom.join(', ')}) o arriésgate y gira nuevamente...`;
              } else if(prem.length === 1 && !arr3.includes(prem[0]-1)){
                valNext = false;
                message = `Reclama tu premio prendiente:  (${nom.join(', ')})`;
              }
    
              await t.commit();
              return {success:true,code:'002',_msv:match,message:'Tienes una partida en curso...',_authg:tokenGen,message,_om4:valNext};

              break;
            default:
              await t.rollback(); 
              return { success: false, code: '001', message: 'No existe este tipo de juego' };
              break;
          }
          
          break;
        default:
          await t.rollback();
          return {success:false,code:'001',message:'No existe esta acción para este evento...'};
          break;
      }

      //const LOPKJ=generateKey();
      //return NewUserTickets ? {success:true,code: '000',LOPKJ,OIOII: encrypt(String(NewUserTickets.tickets),LOPKJ)} : {success:true,code: '000',LOPKJ,OIOII:encrypt(String(0),LOPKJ)};
    } catch (error) {
      await t.rollback();
      console.error('Error al setear u obtener partida:', error);
      throw new Error('Error en el servidor');
    }
  }

  async verifyToken(user,token) {
    const t = await sequelize.transaction();
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
        return { success: false, code: '001', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
      }

      await t.commit();
      return {success:true,code: '000'};
    } catch (error) {
      await t.rollback();
      console.error('Error al verificar token:', error);
      throw new Error('Error en el servidor');
    }
  }

  async getSlots(user) {
    try {
      const userId = await UserGameInfo.findOne({
        attributes:['id'],
        where:{
          name: user
        }
      });

      const result = await UserItemInfo.findOne({
        attributes: [[Sequelize.fn('COUNT', Sequelize.literal('DISTINCT slot')), 'slots']],
        //group: ['name'],
        where: {
          userid: userId.id,
          slot: {
            [Sequelize.Op.ne]: null,
          },
        },
      });

      return result;
    } catch (error) {
      console.error('Error al contar filas por usuario:', error);
      throw new Error('Error en el servidor');
    }
  }

  async buyTickets(pay,isDataIntegrityValid,paramsString,userId,ticketCount,token,req) {
    const t = await sequelize.transaction();
  
    try {

      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid);
      const banInfo = await verifyPacketAndBan(userId,userId, paramsString, verifyPacketEqual, t, req);
      console.log(banInfo);
      if (banInfo) {
        await t.rollback(); // Revertir la transacción en caso de error
        return banInfo;
      }
  
      const trx = await sequelize.transaction();
      // Si la cadena de parámetros no existe, insertarla en trackingpacket
      await TrackingPacket.create(
        {
          packet: paramsString,
          user: userId,
          fecha_uso: new Date(),
        },
        {
          transaction: trx, // Asociar la transacción con esta operación
        }
      );

      await trx.commit();

      // Verificar token:
      const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: {
          token: token,
          id: userId,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!sessionToken){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '005', message: 'Token inválido o sesión antigua para generar esta compra...' };
      }

      var payment;
      var typem;
      var ticketsPrice;
      var origen;
      var tiporec;

      switch (pay) {
        case '_vactdc001':
          payment = 1;
          typem = 'cash';
          ticketsPrice = 1000;
          origen = 4;
          tiporec = 3;
          break;
        case '_ncptft002':
          typem = 'oro';
          payment = 2;
          ticketsPrice = 2000;
          origen = 5;
          tiporec = 4;
          break;
        case '_epvtcg003':
          typem = 'puntos de evento';
          payment = 3;
          ticketsPrice = 20;
          origen = 8;
          tiporec = 12;
          break;
        default:
          payment = null;
          typem = 'NULL';
          ticketsPrice = 0;
          origen = 0;
          tiporec = 0;
          break;
      }

      if(payment === null){
        await t.rollback();
        return { success: false, code: '100', message: 'El tipo de pago seleccionado no es válido' };
      }

      var currencyAmount;
      var amount;
      // var typem = payment === 1 ? 'cash' : 'oro';

      const params = {};
      
      if(payment===1){
        currencyAmount = await Cash.findOne({
          attributes: ['cash'],
          where: {
            id: userId,
          },
          transaction: t,
        });
        amount = currencyAmount.cash;
      } else if(payment===2) {
        currencyAmount = await UserGameInfo.findOne({
          attributes: ['gold'],
          where: {
            name: userId,
          },
          transaction: t,
        });
        amount = currencyAmount.gold;
      } else{
        currencyAmount = await EventPoint.findOne({
          // attributes: ['Points'],
          where: sequelize.where(sequelize.fn('SUBSTRING_INDEX', sequelize.col('User'), ' ', 1), userId),
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        amount = currencyAmount.Points;
      }
  // console.log('a');

      // const ticketsPrice = payment === 1 ? 1000 : 2000; // Precio de un ticket en cash u oro
  
      if (!currencyAmount || amount < ticketsPrice * ticketCount) {
        await t.rollback();
        return { success: false, code: '001', message: `No tienes suficiente(s) ${typem} para esta compra`};
      }
  
      if(payment === 1){
        const [updatedTicketCount, updatedCash] = await Promise.all([
          Ticket.increment('tickets', { by: ticketCount, where: { id: userId }, transaction: t }),
          Cash.decrement('cash', { by: ticketsPrice * ticketCount, where: { id: userId }, transaction: t }),
        ]);

        if (updatedTicketCount[0] === 0 || updatedCash[0] === 0) {
          await t.rollback();
          return { success: false, code: '100', message: 'Error al realizar la compra de tickets de cash' };
        }
      } else if (payment === 2){
        const [updatedTicketCount, updatedCash] = await Promise.all([
          TicketOro.increment('tickets', { by: ticketCount, where: { id: userId }, transaction: t }),
          UserGameInfo.decrement('gold', { by: ticketsPrice * ticketCount, where: { name: userId }, transaction: t }),
        ]);

        if (updatedTicketCount[0] === 0 || updatedCash[0] === 0) {
          await t.rollback();
          return { success: false, code: '100', message: 'Error al realizar la compra de tickets de oro' };
        }

      } else{
        // Obtener los puntos del usuario y luego actualizarlo

        // Actualizar los puntos y guardar+
        // console.log(currencyAmount);
        currencyAmount.Points -= ticketsPrice * ticketCount;
        await currencyAmount.save({ transaction: t });
        // console.log(1);
        // Actualizar los tickets
        const updatedTicketCount = await Ticket.increment('tickets', {
          by: ticketCount,
          where: { id: userId },
          transaction: t,
        });
        // console.log(2);

        params['ep'] = currencyAmount.Points;

        if (updatedTicketCount[0] === 0 || currencyAmount.Points < 0) {
          await t.rollback();
          return { success: false, code: '100', message: 'Error al realizar la compra de giros' };
        }

      }

      await LogRewardsUser.create({  
        user:userId,
        origen:origen,
        recompensa:ticketCount,
        tipo_recompensa: tiporec,
        //origen_2: type,
        fecha: new Date(), 
      }, { transaction: t });
  
      await t.commit();

     
      return { success: true, code: '000', message: 'Se ha realizado tu compra de manera exitosa',params};
    } catch (error) {
      await t.rollback();
      throw new Error('Error al realizar la compra de tickets');
    }
  }
  

  async playGameSelector(tknGame,opcion,token,modalidad,type,isDataIntegrityValid,paramsString,userId,user2,key1,key2, req) {
    const t = await sequelize.transaction(); // Iniciar una transacción

    try {
      // Concatenar los parámetros en una cadena
  
      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid) && (userId === user2) && (key1 === key2);
      /*console.log(userId);
      console.log(user2);
      console.log(orderPrize);
      console.log(idRoulette2);*/
      console.log("Re-verificación:".magenta, verifyPacketEqual ? String(verifyPacketEqual).green :  String(verifyPacketEqual).red);
      const banInfo = await verifyPacketAndBan(userId, user2, paramsString, verifyPacketEqual, t, req);
  
      if (banInfo) {
        await t.rollback(); // Revertir la transacción en caso de error
        return banInfo;
      }
  
      const trx = await sequelize.transaction(); 
      // Si la cadena de parámetros no existe, insertarla en trackingpacket
      await TrackingPacket.create(
        {
          packet: paramsString,
          user: userId,
          fecha_uso: new Date(),
        },
        {
          transaction: trx, // Asociar la transacción con esta operación
        }
      );

      await trx.commit(); 

      // Verificar token:
      const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: {
          token: token,
          id: userId,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!sessionToken){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '999', message: '¡Esta sesión es antigua! No puedes tener más de una sesión abierta para jugar' };
      }

      /*
      if(userId.toLowerCase()=='joimar123'){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '005', message: 'Cierra todas las pestañas del COUNTDOWN ¡Cierra sesión y actualiza el navegador!' };
      }*/

      //Primero verificar si el juego esta en modo show :)
      const gameActive = await Evento.findOne({
            where: {
                id: type,
                show: 1
            },
            transaction: t
        });

      // Revertir la transacción en caso de error
      if(!gameActive){
        await t.rollback();
        return { success: false, code: '999', message:`Este evento ya ha concluido. ¡Por favor, actualice la página!` };
      }

      // Obtener todos los premios de la tabla rouletteprizes según tipo de evento:
      const GameRes = await gamesService.getPrizeByGame(type,opcion,userId,t);

      if(GameRes.code){
        console.log('Win:'.magenta,'false'.red);
        return GameRes;
      }

      const prizesGame = GameRes.all;

      if(!GameRes.win){
        console.log('Win:'.magenta,'false'.red);
        await t.commit(); // Revertir la transacción en caso de error
        return { success: false, code: '400',params: GameRes.params, message: '¡Perdiste! Se te retornará el 50% del costo del giro, suerte para la próxima :)' };
      }

      if (!prizesGame) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '200', message: 'No se encontró premios para este juego' };
      }

      // const prizesGame = allPrizes[selectedItem];
      //console.log(prizesGame);

      var typePrize = prizesGame.type;
      // var cofres; //solo para juego 5 y 6

      // Verificar token (todos los juegos sin partida):
      const tokenCount = await GameAuth.findOne({
        attributes: ['token'],
        where: {
          token: tknGame,
          user: userId,
          type_game: type,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if(!tokenCount){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '999', message: 'Has abierto el juego en otra pestaña...' };
      }

      // Verificar si el premio excedio el limite :( :

      if (prizesGame.limite > 0 && prizesGame.users >= prizesGame.limite || prizesGame.limite == -1){
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '100', message:`El premio '${prizesGame.name}' ya ha llegado ha su límite de usuarios. Vuelve a girar la ruleta para obtener un premio :)`};
      } else if(prizesGame.limite > 0 && prizesGame.users < prizesGame.limite){
        //update
        await PrizesGame.increment(
          'users',
          { by: 1, where: { id: prizesGame.id  }, transaction: t }
        );
      }

      const params = {};
// console.log('aqui no');
      // Acciones segun tipo de evento, Ruleta 0, Count 1, etc...
      switch (type) {
        /**
         * Evento de nivel
         * opcion: lvl
         * 
         */
        case 1:
          // Verificar modalidad:

          if(modalidad > 0){
            await t.rollback(); 
            return { success: false, code: '200', message: 'No existe este tipo de modalidad para este juego' };
          }

          const res = await gamesService.eventLevelVerificator(type,opcion,userId,t,prizesGame);
          // console.log(res);

          if (!res.success){
            return res;
          }

          params['_pws'] = res.po;

          break;
        //Ruleta
        case 3:
          var userTickets;
          //var slotsAvaible;
          var typename;
          //Acciones según modalidad:
          switch (modalidad) {
            //Cash
            case 1:

              typename = 'eventpoints';

              userTickets = await Ticket.findOne({
                // attributes: ['tickets'],
                where: {
                  id: userId,
                },
                transaction: t, // Asociar la transacción con esta consulta
                lock: t.LOCK.UPDATE,
              });

              // Decrementar el ticket del usuario
              await Ticket.decrement('tickets', {
                by: 1,
                where: {
                  id: userId,
                },
                transaction: t, // Asociar la transacción con esta operación
              });

              //slotsAvaible = true;

              break;
            //Oro
            // case 2:
            //   typename = 'oro';

            //   if(prizesGame.type == 0){
            //     typePrize = 5;
            //   }

            //   const usergetId = await UserGameInfo.findOne({
            //     attributes:['id'],
            //     where:{
            //       name: userId
            //     },
            //     transaction: t, // Asociar la transacción con esta consulta
            //   });

            //   if (!usergetId) {
            //     await t.rollback(); // Revertir la transacción en caso de error
            //     return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
            //   }
              

            //   const slots = await UserItemInfo.findOne({
            //     attributes: [[Sequelize.fn('COUNT', Sequelize.literal('DISTINCT slot')), 'slots']],
            //     //group: ['name'],
            //     where: {
            //       userid: usergetId.id,
            //       slot: {
            //         [Sequelize.Op.ne]: null,
            //       },
            //     },
            //     transaction: t, // Asociar la transacción con esta consulta
            //   });

            //   slotsAvaible = (90-slots.dataValues.slots) === 0  ? false : true; 

            //   //console.log(slotsAvaible);

            //   userTickets = await TicketOro.findOne({
            //     attributes: ['tickets'],
            //     where: {
            //       id: userId,
            //     },
            //     transaction: t, // Asociar la transacción con esta consulta
            //   });

            //   // Decrementar el ticket del usuario
            //   await TicketOro.decrement('tickets', {
            //     by: 1,
            //     where: {
            //       id: userId,
            //     },
            //     transaction: t, // Asociar la transacción con esta operación
            //   });
            //   break;
            default:
              await t.rollback(); 
              return { success: false, code: '001', message: 'No existe este tipo de modalidad para este juego' };
              break;
          }

          // Combina los valores de params con los nuevos datos
          Object.assign(params, GameRes.params);
          
          if (!userTickets || userTickets.tickets < 1) {
            await t.rollback(); // Revertir la transacción en caso de error
            if(!userTickets || userTickets.tickets < 1){
              return { success: false, code: '001', message:`No tiene giros suficientes para jugar a la ruleta` };
            } else {
              return { success: false, code: '001', message: 'No tiene slots disponbiles para girar la ruleta de oro' };
            }
          }
          
          break;
        // //Countdown
        // case 1:

        //   //modalidad:

        //   if(modalidad > 0){
        //     await t.rollback(); 
        //     return { success: false, code: '001', message: 'No existe este tipo de modalidad para este juego' };
        //   }
        //   //Verificaciones

        //   //Verificar tiempo de redencion

        //   // Obtener todos los premios de la tabla rouletteprizes según tipo de evento:
        //   const lastDate = await TempPrize.findOne({
        //     attributes: ['fecha'],
        //     where: {
        //       game: type,
        //       user: userId
        //     },
        //     order: [['fecha', 'DESC']],
        //     transaction: t, // Asociar la transacción con esta consulta
        //   });

        //   const vdat = new Date();

        //   if(lastDate){
        //     console.log("TIME : %s - %d",userId,(vdat-lastDate.fecha)/1000); //dif seg

        //     var timedif = (vdat-lastDate.fecha)/1000;
        //     var veriTime;

        //     if(opcion === 0){
        //       veriTime = 300;
        //     } else if (opcion === 1){
        //       veriTime = 120;
        //     } else{
        //       await t.rollback(); 
        //       return { success: false, code: '001', message: 'No existe esta opción en el juego' };
        //     }
        //     // 5 min 300 seg
        //     // 3 min 180 seg

        //     console.log("USER TIME: ",timedif >= veriTime);

        //     if(timedif < veriTime){
        //       await t.rollback(); 
        //       return { success: false, code: '001', message: '¡Alto! Estás canjeando premios demasiado rápido. Recuerda que solo puedes canjear premios cada 5 minutos ¡Evita ser sancionado!' };
        //     }
        //   }


        //   break;
        // //Countdown
        // case 5:
        //   //Verificar piezas:

        //   const userGame = await Matches.findOne({
        //     attributes: ['premios','picked'],
        //         where: {
        //             user: userId,
        //             game: 5,
        //         },
        //     });

        //   // Revertir la transacción en caso de error
        //   if(!userGame){
        //     await t.rollback();
        //     return { success: false, code: '001', message:`No tiene el rompecabezas completo para obtener un cofre nuevo...` };
        //   }

        //   console.log(userGame.picked);
        //   if(JSON.parse(userGame.picked)[0] === 0){
        //     await t.rollback();
        //     return { success: false, code: '001', message:`No tiene Cofres de tipo Básico disponibles para abrir...` };
        //   }

        //   // Resta cofre:

        //   cofres = JSON.parse(userGame.picked);
        //   cofres[0] -= 1;
        //   //const decrementedArr = newArr.map((element) => element - 1);

        //   await Matches.update(
        //     { 
        //       //premios:JSON.stringify(decrementedArr),
        //       picked: JSON.stringify(cofres),
        //     }, //cambiar a codigo_base
        //     { where: { user: userId,game:5, },
        //       transaction: t
        //     },
        //   );

        //   break;
        case 6:
          // //Verificar piezas:

          // const userGame2 = await Matches.findOne({
          //   attributes: ['premios','picked'],
          //       where: {
          //           user: userId,
          //           game: 5,
          //       },
          //   });

          // // Revertir la transacción en caso de error
          // if(!userGame2){
          //   await t.rollback();
          //   return { success: false, code: '001', message:`No tiene el rompecabezas completo para obtener un cofre nuevo...` };
          // }

          // console.log(userGame2.picked);
          // if(JSON.parse(userGame2.picked)[1] === 0){
          //   await t.rollback();
          //   return { success: false, code: '001', message:`No tiene Cofres de tipo Oceanus disponibles para abrir...` };
          // }

          // // Resta cofre:

          // cofres = JSON.parse(userGame2.picked);
          // cofres[1] -= 1;
          // //const decrementedArr = newArr.map((element) => element - 1);

          // await Matches.update(
          //   { 
          //     //premios:JSON.stringify(decrementedArr),
          //     picked: JSON.stringify(cofres),
          //   }, //cambiar a codigo_base
          //   { where: { user: userId,game:5, },
          //     transaction: t
          //   },
          // );

          return { success: false, code: '001', message: 'No existe este tipo de juego' };
        default:
          await t.rollback(); 
          return { success: false, code: '200', message: 'No existe este tipo de juego' };
      }
      // console.log('aqui llego');
      var resWin = await gamesService.setWinPrizes(type,typePrize,prizesGame,userId,t);
      if(!resWin.success) return resWin;
  
      //const key = generateKey();
      //const MnOpQr = encrypt(JSON.stringify(prizesGame), key) + '-' + key;
  
     // Confirmar la transacción si todas las operaciones tienen éxito

      // if(type === 5 || type === 6){
      //   // Obtener todos los premios de la tabla rouletteprizes según tipo de evento:
      //   //console.log('AAAAA AQUI');
      //   const allPrizesFinal = await PrizesGame.findAll({
      //     attributes: ['name', 'url'],
      //     where: {
      //       //orderPrize: orderPrize,
      //       type_game: type,
      //     },
      //     order: [['orderPrize', 'ASC']],
      //     transaction: t, // Asociar la transacción con esta consulta
      //   });

      //     await t.commit();
      //   return { success: true, code: '000', _pw:selectedItem,allpz:allPrizesFinal,_cf:cofres, message };
      // }

      await TempPrize.create(
        {
          user: userId,
          type: typePrize,
          prize: prizesGame.prize,
          game: type,
          opcion: opcion,
          fecha: new Date(),
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      console.log('Win:'.magenta,'true'.green);

      // const pr = await this.getAllPrizes(type,t);
      // _pwb:prizesGame.clase,pr
      // _pw:selectedItem

      await t.commit();
      return { success: true, code: '000', message:resWin.message,params};
    } catch (error) {
      await t.rollback(); // Revertir la transacción en caso de error
      console.error('Error al realizar la operación:', error);
      throw new Error('Error en el servidor');
    }
  }

  async redeemAllPrizesEvent(token,user,authGame,type,isDataIntegrityValid,paramsString, req) {
    const t = await sequelize.transaction(); // Iniciar una transacción

    try {
      // Concatenar los parámetros en una cadena
  
      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid);// && (userId === user2) && ((orderPrize+operator) === res) && (orderPrize === idRoulette2) && (key1 === key2);
      /*console.log(userId);
      console.log(user2);
      console.log(orderPrize);
      console.log(idRoulette2);*/
      console.log("Redeem validate:", verifyPacketEqual);
      const banInfo = await verifyPacketAndBan(user, user, paramsString, verifyPacketEqual, t, req);
  
      if (banInfo) {
        await t.rollback(); // Revertir la transacción en caso de error
        return banInfo;
      }
  
      const trx = await sequelize.transaction(); 
      // Si la cadena de parámetros no existe, insertarla en trackingpacket
      await TrackingPacket.create(
        {
          packet: paramsString,
          user: user,
          fecha_uso: new Date(),
        },
        {
          transaction: trx, // Asociar la transacción con esta operación
        }
      );

      await trx.commit(); 

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
        return { success: false, code: '301', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      //namePrizes prizes

      var prizes;
      var namesPrizes;

      switch (type) {
        case 3:

          // Verifico token...
          const tokenCount = await PumpkinsAuth.findOne({
            attributes: ['token'],
            where: {
              token: authGame,
              user: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!tokenCount){
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
          }

          //Obtener partida en curso
          const match = await Matches.findOne({
            attributes: ['calabazas','premios','picked','nombres'],
            where: {
              user:user,
              estado:1,
              game:type,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!match){
            await t.rollback(); 
            return { success: false, code: '001', message: 'No tienes premios para reclamar o una partida pendiente...' };
          }

          prizes = JSON.parse(match.premios);
          namesPrizes = JSON.parse(match.nombres);

          break;
        case 4:
           // Verifico token...
           const authSlot = await HotslotAuth.findOne({
            attributes: ['token'],
            where: {
              token: authGame,
              user: user,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!authSlot){
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '301', message: 'Has abierto este juego en otra pestaña...' };
          }

          //Obtener partida en curso
          const match4 = await Matches.findOne({
            attributes: ['calabazas','premios','picked','nombres'],
            where: {
              user:user,
              estado:1,
              game:type,
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if(!match4){
            await t.rollback(); 
            return { success: false, code: '001', message: 'No tienes premios para reclamar o una partida pendiente...' };
          }

          prizes = JSON.parse(match4.premios);
          namesPrizes = JSON.parse(match4.nombres);
          break;
        default:
          await t.rollback(); 
          return { success: false, code: '001', message: 'No existe este tipo de juego' };
          break;
      }

      var prizesWin = [];

      //console.log(prizes);
      //console.log(type);

      for (const p of prizes) {
        // Obtener el premio de la tabla rouletteprizes según orderPrize y tipo de evento:
        const prizePumpkin = await PrizesGame.findOne({
          attributes: ['type', 'prize', 'name', 'url'],
          where: {
            orderPrize: p,
            type_game: type,
          },
          transaction: t, // Asociar la transacción con esta consulta
        });
    
        if (!prizePumpkin) {
          await t.rollback(); // Revertir la transacción en caso de error
          return { success: false, code: '302', message: 'No se encontró un premio para las calabazas' };
        }

        prizesWin.push(prizePumpkin);
      }

      //var message;
      var i = 0;

      for(const pr of prizesWin){

        var typePrize = pr.type;

        // Agregar el premio según el tipo
        switch (typePrize) {
          case 0:
            // Obtener el ID de usuario desde UserGameInfo por su nombre
            const userGameInfo = await UserGameInfo.findOne({
              attributes: ['id'],
              where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
              },
              transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGameInfo) {
              await t.rollback(); // Revertir la transacción en caso de error
              return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
            }
            

            //Verificar si el premio es una pocion ?
            /*const itemData = await ItemInfo.findOne({
              attributes: ['type'],
              where: {
                id: pr.prize, // Cambia esto para usar el nombre de usuario correcto
              },
              transaction: t, // Asociar la transacción con esta consulta
            });
        
            if (!itemData) {
              await transaction.rollback(); // Revertir la transacción en caso de error
              return { success: false, code: '402', message: 'ID de Item no encontrado' };
            }

            if(itemData.type === 12){
              //Insertar en tabla poisions :)
              //Verificar si el usuario ya tiene esa pocion:
              const userPocion = await UserPoisons.findOne({
                where: {
                  idpocion: pr.prize, // Cambia esto para usar el nombre de usuario correcto
                  user: user,
                },
                transaction: t, // Asociar la transacción con esta consulta
              });
          
              if (!userPocion) {
                await UserPoisons.create(
                  {
                    user: user,
                    idpocion: pr.prize,
                    cantidad: 1,
                  },
                  {
                    transaction: t, // Asociar la transacción con esta operación
                  }
                );
              } else{
                await UserPoisons.increment(
                  'cantidad',
                  { by: 1, where: { user: user,idpocion: pr.prize }, transaction: t }
                );
              }
            } else{*/
              // Agregar el premio a PendingPresents usando el ID de usuario obtenido
              await PendingPresents.create(
                {
                  present_id: pr.prize,
                  user_id: userGameInfo.id, // Usar el ID de usuario obtenido
                  added_time: new Date(),
                },
                {
                  transaction: t, // Asociar la transacción con esta operación
                }
              );
            //}
    
            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: pr.prize,
                game: type,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );

            break;
          case 1:
            // Actualizar el gold en UserGameInfo
            await UserGameInfo.increment(
              'gold',
              { by: pr.prize, where: { name: user }, transaction: t }
            );
    
            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: pr.prize,
                game: type,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
            break;
          case 2:
            // Actualizar el cash en Cash
            await Cash.increment(
              'cash',
              { by: pr.prize, where: { id: user }, transaction: t }
            );
    
            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: pr.prize,
                game: type,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
            break;
          case 3:
            // Actualizar el cash en Cash
            await Ticket.increment(
              'tickets',
              { by: pr.prize, where: { id: user }, transaction: t }
            );
    
            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: pr.prize,
                game: type,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
            break;
          case 4:
              // Actualizar el cash en Cash
              await TicketOro.increment(
                'tickets',
                { by: pr.prize, where: { id: user }, transaction: t }
              );
      
              // Insertar el premio en temp_prizes
              await TempPrize.create(
                {
                  user: user,
                  type: typePrize,
                  prize: pr.prize,
                  game: type,
                  fecha: new Date(),
                },
                {
                  transaction: t, // Asociar la transacción con esta operación
                }
              );
              break;
          case 5:
            //Obtener id de usuario
            // Obtener el ID de usuario desde UserGameInfo por su nombre
            const userGame = await UserGameInfo.findOne({
              attributes: ['id'],
              where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
              },
              transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGame) {
              await t.rollback(); // Revertir la transacción en caso de error
              return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
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
              return { success: false, code: '001', message: 'No tiene slots disponbiles para girar la ruleta de oro' };
            }

            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: pr.prize,
                game: type,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );

            const limit = await calculatePowerUse(0,2);
            const responseAmount = await getAmountItem(pr.prize,t);

            if(responseAmount.success === false && responseAmount.code === '402'){
              return responseAmount;
            }
            //console.log(limit);

            //Si tiene, guardar el premio temporal en useriteminfo
            await UserItemInfo.create(
              {
                userid: userGame.id,
                itemid: pr.prize,
                slot: slotFree,
                limittime: limit, //calculo como power use
                exp: responseAmount,
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );

            break;
          case 6:
            // Obtener el powertime de usuario desde UserGameInfo por su nombre
            const userGamePower = await UserGameInfo.findOne({
              attributes: ['powertime'],
              where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
              },
              transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGamePower) {
              await t.rollback(); // Revertir la transacción en caso de error
              return { success: false, code: '202', message: 'Usuario no encontrado' };
            }

            const powertimefinal = await calculatePowerUse(userGamePower.powertime,pr.prize);
            //console.log(powertimefinal);
            await UserGameInfo.update(
              { powertime: powertimefinal}, //cambiar a codigo_base
              { where: { name: user },
                transaction: t 
              },
            );

            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: pr.prize,
                game: type,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );

            break;
          case 7:
            // Obtener tickets
            const ticketsUser = await TicketsMode.findOne({
              where: {
                user: user, // Cambia esto para usar el nombre de usuario correcto
                type: 1,
                mode: 71
              },
              transaction: t, // Asociar la transacción con esta consulta
            });

            if(!ticketsUser){
              // crear
              await TicketsMode.create(
                {
                  user: user,
                  tickets: pr.prize,
                  type: 1,
                  mode: 71
                },
                {
                  transaction: t, // Asociar la transacción con esta operación
                }
              );
            } else{
              // Tickets de themepark
              await TicketsMode.increment(
                'tickets',
                { by: pr.prize, where: { user: user }, transaction: t }
              );
            }
            
    
            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: pr.prize,
                game: type,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
            break;
          case 8:
            // Actualizar el gold en UserGameInfo
            // Dividir la cadena por espacios y obtener el primer elemento
            const goldD = namesPrizes[i].split(' ')[0];
            //console.log('GOLD:',namesPrizes[i]);

            // Convertir el primer elemento a número
            const goldIn = parseInt(goldD, 10);

            await UserGameInfo.increment(
              'gold',
              { by: goldIn, where: { name: user }, transaction: t }
            );
    
            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: goldIn,
                game: type,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
            break;
          case 9:
            // Actualizar el cash en Cash
             // Dividir la cadena por espacios y obtener el primer elemento
             const cashd = namesPrizes[i].split(' ')[0];
             //console.log('CASH:',namesPrizes[i]);

             // Convertir el primer elemento a número
             const cashIn = parseInt(cashd, 10);

            await Cash.increment(
              'cash',
              { by: cashIn, where: { id: user }, transaction: t }
            );
    
            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: cashIn,
                game: type,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
            break;
          case 10:
            // Insertar un SET

            // Obtener el ID de usuario desde UserGameInfo por su nombre
            const userGameInfoID = await UserGameInfo.findOne({
              attributes: ['id'],
              where: {
                name: user, // Cambia esto para usar el nombre de usuario correcto
              },
              transaction: t, // Asociar la transacción con esta consulta
            });
    
            if (!userGameInfoID) {
              await t.rollback(); // Revertir la transacción en caso de error
              return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
            }

            //console.log(pr.prize);
            //Obtener todos los id's del set:
            const itemsSet = await SetItem.findAll({
              attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('itemid')), 'itemid']],
              where: {
                idset: pr.prize,
              },
              raw: true,
              transaction: t,
            });

            // Mapear los resultados a un array de números
            const arrayItems = itemsSet.map((item) => item.itemid);
            //console.log(arrayItems);

            for(const i of arrayItems){
              // Agregar el premio a PendingPresents usando el ID de usuario obtenido
              await PendingPresents.create(
                {
                  present_id: i,
                  user_id: userGameInfoID.id, // Usar el ID de usuario obtenido
                  added_time: new Date(),
                },
                {
                  transaction: t, // Asociar la transacción con esta operación
                }
              );

               // Insertar el premio en temp_prizes
              await TempPrize.create(
                {
                  user: user,
                  type: 0,
                  prize: i,
                  game: type,
                  fecha: new Date(),
                },
                {
                  transaction: t, // Asociar la transacción con esta operación
                }
              );
            }

            break;
          default:
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '201', message: 'Tipo de premio no válido' };
        }

        i+=1;
      }
  
      await t.commit(); // Confirmar la transacción si todas las operaciones tienen éxito
  
      return { success: true, code: '000',_om4:namesPrizes, message:"Felicidades :)" };
    } catch (error) {
      await t.rollback(); // Revertir la transacción en caso de error
      console.error('Error al realizar la operación:', error);
      throw new Error('Error en el servidor');
    }
  }


  async redeemCupon(paramsString,token,user,cupon,isDataIntegrityValid, req) {
    const t = await sequelize.transaction();
  
    try {

      // Verificar el paquete utilizando la clase PacketVerifier

      const verifyPacketEqual = (isDataIntegrityValid); //&& (userId === userId2) && ((ticketCount+operator) === resOp) && (ticketCount === ticketCount2) && (key1 === key2);
      const banInfo = await verifyPacketAndBan(user,user, paramsString, verifyPacketEqual, t, req);

      console.log(banInfo);

      if (banInfo) {
        await t.rollback(); // Revertir la transacción en caso de error
        return banInfo;
      }

      const trx = await sequelize.transaction(); 
      // Si la cadena de parámetros no existe, insertarla en trackingpacket
      await TrackingPacket.create(
        {
          packet: paramsString,
          user: user,
          fecha_uso: new Date(),
        },
        {
          transaction: trx, // Asociar la transacción con esta operación
        }
      );

      await trx.commit(); 

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
        return { success: false, code: '300', message: 'Token inválido o tienes una sesión iniciada en otro navegador...' };
      }

      // Obtener el tipo, nombre,uri:
      // Obtener el premio de la tabla rouletteprizes según orderPrize y tipo de evento:
      const cuponPrize = await Cupon.findOne({
        attributes: ['type', 'id_prize', 'name_prize', 'uri','limite','users'],
        where: {
          ticket: cupon,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });
  
      if (!cuponPrize) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '004', message: 'El cupón ingresado no existe' };
      }

      //console.log(cuponPrize);

      //Verificar si ya expiro:

      if (cuponPrize.limite <= cuponPrize.users) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '002', message: 'El cupón ingresado ya expiró' };
      }

      //Verificar si el usuario ya redimio anteriormente el cupon:

      const userRedeem = await TempCupon.findOne({
        attributes: ['id'],
        where: {
          user: user,
          ticket: cupon,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      if (userRedeem) {
        await t.rollback(); // Revertir la transacción en caso de error
        return { success: false, code: '001', message: 'Ya canjeaste este cupón anteriormente' };
      }

      var typePrize = cuponPrize.type;
      var message;

      // Agregar el premio según el tipo
      switch (typePrize) {
        case 0:
          // Obtener el ID de usuario desde UserGameInfo por su nombre
          const userGameInfo = await UserGameInfo.findOne({
            attributes: ['id'],
            where: {
              name: user, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if (!userGameInfo) {
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
          }
          
          // Agregar el premio a PendingPresents usando el ID de usuario obtenido
          await PendingPresents.create(
            {
              present_id: cuponPrize.id_prize,
              user_id: userGameInfo.id, // Usar el ID de usuario obtenido
              added_time: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );

          // Insertar el premio en temp_prizes
          const res = await TempPrize.create(
            {
              user: user,
              type: typePrize,
              prize: cuponPrize.id_prize,
              game: 2,
              fecha: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );

          //console.log(res);

          message = `Has obtenido un(a) ${cuponPrize.name_prize}`;
          break;
        case 1:
           //Verificar que el usuario exista:
          const userGold = await UserGameInfo.findOne({
            attributes: ['id','gold'],
            where: {
              name: user, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if (!userGold) {
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '004', message: 'Usuario no encontrado [GOLD: Comunicar con algún administrador]' };
          }

          // Actualizar el gold en UserGameInfo
          await UserGameInfo.increment(
            'gold',
            { by: cuponPrize.id_prize, where: { name: user }, transaction: t }
          );

          // Insertar el premio en temp_prizes
          await TempPrize.create(
            {
              user: user,
              type: typePrize,
              prize: cuponPrize.id_prize,
              game: 2,
              fecha: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );
          message = `Has obtenido ${cuponPrize.id_prize} de Oro`;
          break;
        case 2:
           //Verificar que el usuario exista:
          const userCash = await Cash.findOne({
            attributes: ['cash'],
            where: {
              id: user, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });
    
          if (!userCash) {
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '004', message: 'Usuario no encontrado [CASH: Comunicar con algún administrador]' };
          }

          // Actualizar el cash en Cash
          await Cash.increment(
            'cash',
            { by: cuponPrize.id_prize, where: { id: user }, transaction: t }
          );

          // Insertar el premio en temp_prizes
          await TempPrize.create(
            {
              user: user,
              type: typePrize,
              prize: cuponPrize.id_prize,
              game: 2,
              fecha: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );
          message = `Has obtenido ${cuponPrize.id_prize} de Cash`;
          break;
        case 3:
          // Actualizar el cash en Cash
          await Ticket.increment(
            'tickets',
            { by: cuponPrize.id_prize, where: { id: user }, transaction: t }
          );

          // Insertar el premio en temp_prizes
          await TempPrize.create(
            {
              user: user,
              type: typePrize,
              prize: cuponPrize.id_prize,
              game: 2,
              fecha: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );
          message = `Has obtenido ${cuponPrize.id_prize} ticket(s) de cash`;
          break;
        case 4:
            // Actualizar el cash en Cash
            await TicketOro.increment(
              'tickets',
              { by: cuponPrize.id_prize, where: { id: user }, transaction: t }
            );
    
            // Insertar el premio en temp_prizes
            await TempPrize.create(
              {
                user: user,
                type: typePrize,
                prize: cuponPrize.id_prize,
                game: 2,
                fecha: new Date(),
              },
              {
                transaction: t, // Asociar la transacción con esta operación
              }
            );
            message = `Has obtenido ${cuponPrize.id_prize} ticket(s) de oro`;
            break;
        case 5:
          //Obtener id de usuario
          // Obtener el ID de usuario desde UserGameInfo por su nombre
          const userGame = await UserGameInfo.findOne({
            attributes: ['id'],
            where: {
              name: user, // Cambia esto para usar el nombre de usuario correcto
            },
            transaction: t, // Asociar la transacción con esta consulta
          });

          if (!userGame) {
            await t.rollback(); // Revertir la transacción en caso de error
            return { success: false, code: '202', message: 'ID de Usuario no encontrado' };
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
            return { success: false, code: '003', message: 'No tiene slots disponbiles para canjear el premio' };
          }

          // Insertar el premio en temp_prizes
          await TempPrize.create(
            {
              user: user,
              type: typePrize,
              prize: cuponPrize.id_prize,
              game: 2,
              fecha: new Date(),
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );

          //Si tiene, guardar el premio temporal en useriteminfo
          await UserItemInfo.create(
            {
              userid: userGame.id,
              itemid: cuponPrize.id_prize,
              slot: slotFree,
              limittime: 0,
            },
            {
              transaction: t, // Asociar la transacción con esta operación
            }
          );

          message = `Has obtenido un(a) ${cuponPrize.name_prize} temporal`;
          break;
        default:
          await t.rollback(); // Revertir la transacción en caso de error
          return { success: false, code: '201', message: 'Tipo de premio no válido' };
      }

      await Cupon.increment(
        'users',
        { by: 1, where: { ticket: cupon }, transaction: t }
      );

      await TempCupon.create(
        {
          user: user,
          ticket: cupon,
          fecha: new Date()
        },
        {
          transaction: t, // Asociar la transacción con esta operación
        }
      );

      await LogRewardsUser.create({  
        user:user,
        origen:1,
        origen_2:2,
        recompensa:cuponPrize.id_prize,
        tipo_recompensa: typePrize,
        fecha: new Date(), 
      }, { transaction: t });

      //const key = generateKey();
      //const MnOpQr = encrypt(JSON.stringify(cuponPrize), key) + '-' + key;

      await t.commit(); // Confirmar la transacción si todas las operaciones tienen éxito

      return { success: true, code: '000', message };
    
    }
    catch (error) {
        await t.rollback();
        throw new Error('Error al canjear cupón');
    }
  } 

  async getAllPrizesGames(type) {
    try {
      const roulettePrizes = await PrizesGame.findAll({
        attributes: ['orderPrize','name','url','clase','limite','users'],
        where: {
          type_game: type,
        },
        order: [['orderPrize', 'ASC']],
      });
  
      // Función para calcular el nombre con el rango y tipo
      const calculateRandomName = (name, type) => {
        const [min, max] = name.split('-').map(Number);
        const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
        return `${randomValue} ${type === 9 ? 'de Cash' : 'de Oro'}`;
      };
  
      // Mapear y ajustar los nombres según el tipo
      const adjustedPrizes = roulettePrizes.map((prize) => {
        if (prize.type === 8 || prize.type === 9) {
          const adjustedName = calculateRandomName(prize.name, prize.type);
          return {
            ...prize.toJSON(),
            name: adjustedName,
          };
        }
        return prize.toJSON();
      });
  
      return adjustedPrizes;
    } catch (error) {
      throw new Error('Error al obtener los premios de la ruleta');
    }
  }

  async getAllPrizes(type,t) {
    try {
      const roulettePrizes = await PrizesGame.findAll({
        //attributes: ['name','url'],
        where: {
          type_game: type,
        },
        order: [['orderPrize', 'ASC']],
        transaction: t,
      });
  
      // Función para calcular el nombre con el rango y tipo
      const calculateRandomName = (name, type) => {
        const [min, max] = name.split('-').map(Number);
        const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
        return `${randomValue} ${type === 9 ? 'de Cash' : 'de Oro'}`;
      };
  
      // Mapear y ajustar los nombres según el tipo
      const adjustedPrizes = roulettePrizes.map((prize) => {
        if (prize.type === 8 || prize.type === 9) {
          const adjustedName = calculateRandomName(prize.name, prize.type);
          return {
            ...prize.toJSON(),
            name: adjustedName,
          };
        }
        return prize.toJSON();
      });
  
      return adjustedPrizes;
    } catch (error) {
      throw new Error('Error al obtener los premios de la ruleta');
    }
  }
  
  async setAuthGame(token,user,game) {
    const t = await sequelize.transaction();
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
        return { success: false, code: '999', message: 'Token inválido o sesión antigua para este evento...' };
      }
     
      //Verificar si ya existe token en tabla:
      const countAuth = await GameAuth.findOne({
        where: {
          user: user, // Cambia esto para usar el nombre de usuario correcto
          type_game:game,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      const tokenGen = generateRandomToken();

      if(!countAuth){
        await GameAuth.create(
          {
            user: user,
            token: tokenGen,
            date: new Date(),
            type_game:game
          },
          {
            transaction: t, // Asociar la transacción con esta operación
          }
        );
      } else{
        await GameAuth.update(
          { date: new Date(),
            token: tokenGen,
          },
          {
              where: { user: user, type_game : game },
              transaction: t,
          }
      );
      }

      const match = await gamesService.findMatch(game,user,t);

      await t.commit();
      return { success: true, code: '000',_athg:tokenGen, _msv:match };
    } catch (error) {
      await t.rollback();
      console.error('Error al obtener la crear auth de juego y obtener partida:', error);
      throw new Error('Error en el servidor');
    }
  }

  async getPieceAndChest(userId,token) {
    try {
      const userGame = await Matches.findOne({
      attributes: ['premios','picked'],
          where: {
              user: userId,
              game: 5,
          },
      });

     if(!userGame){
        return {success:true,_lp:[],_cf:0}
     } else{
        return {success:true,_lp:JSON.parse(userGame.premios),_cf:JSON.parse(userGame.picked)}
     }

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      throw new Error('Error en el servidor');
    }
  }

  async obtenerNuevaPieza(user,token) {
    const t = await sequelize.transaction();
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
        return { success: false, code: '002', message: 'Token inválido o sesión antigua para este evento...' };
      }

      //Verificar tickets:
      const userTickets = await Ticket.findOne({
        attributes: ['tickets'],
        where: {
          id: user,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      // Revertir la transacción en caso de error
      if(!userTickets || userTickets.tickets < 1){
        await t.rollback();
        return { success: false, code: '001', message:`No tiene tickets suficientes para jugar en este evento. Refresca la página...` };
      }

      // Decrementar el ticket del usuario
      await Ticket.decrement('tickets', {
        by: 1,
        where: {
          id: user,
        },
        transaction: t, // Asociar la transacción con esta operación
      });

      const userGame = await Matches.findOne({
        attributes: ['premios','picked'],
            where: {
                user: user,
                game: 5,
            },
        });

        //Difficl pieza 4 y 13
      const probs = [0.06, 0.07,0.07,0.06,0.07,0.07,0.07,0.05,0.04,0.07,0.06,0.07,0.06,0.07,0.06,0.05];

       // Realizar el calculo de probabilidad:
       const randomProb = Math.random();
       let cumulativeProb = 0;
       let selectedPiece = 0;
 
       //console.log(allPrizes.length);
 
       for (let i = 0; i < probs.length; i++) {
         //console.log(allPrizes[i]);
         cumulativeProb += probs[i];
         if (randomProb <= cumulativeProb) {
          selectedPiece = i;
           break;
         }
       }
       
       var newArr;

      if(!userGame){
        newArr = Array(16).fill(0);
        newArr[selectedPiece] += 1;

        await Matches.create(
          {
            user: user,
            calabazas: JSON.stringify([]),
            premios:JSON.stringify(newArr),
            picked:JSON.stringify([0,0]),
            nombres:JSON.stringify([]),
            game:5,
          },
          {
            transaction: t, // Asociar la transacción con esta operación
          }
        );

      } else{
        newArr = JSON.parse(userGame.premios);
        newArr[selectedPiece] += 1;

        await Matches.update(
          { 
            premios:JSON.stringify(newArr),
          }, //cambiar a codigo_base
          { where: { user: user,game:5, },
            transaction: t
          },
        );
      }

      const againTickets = await Ticket.findOne({
        attributes: ['tickets'],
        where: {
          id: user,
        },
        transaction: t, // Asociar la transacción con esta consulta
      });

      await t.commit();
      return {success:true,code:'000',_lp:newArr,ntc:againTickets.tickets,message:'Obtuviste la pieza n°'+String(selectedPiece+1)}

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      console.error('Error al obtener la pieza:', error);
      throw new Error('Error en el servidor');
    }
  }

  async obtenerCofre(user,token) {
    const t = await sequelize.transaction();
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
        return { success: false, code: '002', message: 'Token inválido o sesión antigua para este evento...' };
      }

      //Verificar piezas:

      const userGame = await Matches.findOne({
        attributes: ['premios','picked'],
            where: {
                user: user,
                game: 5,
            },
        });
       
       var newArr;

       // Revertir la transacción en caso de error
      if(!userGame){
        await t.rollback();
        return { success: false, code: '001', message:`No tiene el rompecabezas completo para obtener un cofre nuevo...` };
      }

      newArr = JSON.parse(userGame.premios);

      if(!newArr.every(count => count > 0)){
        await t.rollback();
        return { success: false, code: '001', message:`No tiene el rompecabezas completo para obtener un cofre nuevo...` };
      }

        //0: cofre básico, 1: cofre osceanus
        const probs = [0.8,0.2];
        const names = ['Básico','Oceanus'];

        // Realizar el calculo de probabilidad:
        const randomProb = Math.random();
        let cumulativeProb = 0;
        let selected= 0;
  
        //console.log(allPrizes.length);
  
        for (let i = 0; i < probs.length; i++) {
          //console.log(allPrizes[i]);
          cumulativeProb += probs[i];
          if (randomProb <= cumulativeProb) {
           selected = i;
            break;
          }
        }

      // Resta piezas, aumenta un cofre:

      const cofres = JSON.parse(userGame.picked);
      cofres[selected] += 1;
      const decrementedArr = newArr.map((element) => element - 1);

      await Matches.update(
        { 
          premios:JSON.stringify(decrementedArr),
          picked: JSON.stringify(cofres),
        }, //cambiar a codigo_base
        { where: { user: user,game:5, },
          transaction: t
        },
      );

      await t.commit();
      return {success:true,code:'000',_lp:decrementedArr,_cf:cofres,message:`¡Has obtenido un Cofre ${names[selected]}!`};

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      console.error('Error al obtener la pieza:', error);
      throw new Error('Error en el servidor');
    }
  }

  async obtenerTodos() {
    try {

      const eventos = await Evento.findAll({
        where:{
          estado:1,
        }
      });
     
      return eventos;

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      console.error('Error al obtener los eventos:', error);
      throw new Error('Error en el servidor');
    }
  }

  async setPersonaje(user,token,character) {
    const t = await sequelize.transaction();
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
        return { success: false, code: '999', message: 'Token inválido o sesión antigua para este evento...' };
      }

       // Verificar si el usuario ya seleccionó un personaje
       const existingEntry = await EventLevelCharacter.findOne({
        where: {
            user: user,
        },
        transaction: t,
      });

      if (existingEntry) {
          await t.rollback();
          return { success: false, code: '200', message: '¡El usuario ya ha seleccionado un personaje!' };
      
      }

      // Guardar usuario y personaje seleccionado en eventlevelcharacter
      await EventLevelCharacter.create({ user: user, characterid: character }, { transaction: t });

      // Obtener el userid desde usergameinfo
      const userGameInfo = await UserGameInfo.findOne({
        attributes: ['id'],
        where: { name: user },
        transaction:t // Añadir transacción aquí
      });

      if (!userGameInfo) {
          throw new Error('Usuario no encontrado');
      }

      const userId = userGameInfo.id;

      const characterSelected = await CharacterInfo.findOne({
        attributes: ['id', 'name', 'level', 'Class'],
        where: {
            userid: userId,
            id: character
        },
        transaction:t // Añadir transacción aquí
      });

      if (!characterSelected) {
          await t.rollback();
          return { success: false, code: '200', message: 'El personaje que has seleccionado no existe o estás intentando tomar un personaje que no te pertenece' };
      }

      const niveles = Array.from({ length: 6 }, (_, index) => {
        if (index === 9) {
            return 99;
        } else {
            return (index + 1) * 5;
        }
      });

      // console.log(levelsSuperados);
      // console.log(niveles);

      // Crear array de partida
      const modifyPartida = niveles.map(nivel => characterSelected.level >= nivel ? false : true);

      const  match = await Matches.findOne({
        attributes: ['id','partida', 'premios_obtenidos'],
        where: {
          user: user,
          game: 1, //luego enviar parametro...
          estado: 1,
        },
        transaction:t // Añadir transacción aquí
      });
      
      await Matches.update(
        { partida: JSON.stringify(modifyPartida) },
        { where: { id: match.id }, transaction:t }
      );

      const matchM = {
        mt: modifyPartida,
        _pws: JSON.parse(match.premios_obtenidos),
        new: false,
        uch:null,
        chs:characterSelected,
      };
  
      await t.commit();
      return {success:true,code:'000',_msv:matchM};

      //return userTicket && userTicketOro ? {userTicket,userTicketOro} : null;
    } catch (error) {
      console.error('Error al setear personaje:', error);
      throw new Error('Error en el servidor');
    }
  }
  
}

export default new EventService();
