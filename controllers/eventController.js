import EventService from '../services/eventService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";

class EventController {
  async verifyTickets(req, res) {
    try {
      const userId = req.params.id;
      const resultCode = await EventService.verifyUserTickets(userId);

      if (resultCode) {
        return res.status(200).json({ response_code: resultCode });
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Error al verificar los tickets del usuario:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async getTickets(req, res) {

    try {
      const {b7Yx9Q,v8Lw2Z} = req.body;

      const userId = decrypt(v8Lw2Z,b7Yx9Q);    

      console.log("---------------------------------------------------------------".magenta);
      console.log("GET TICKETS (GIROS) - FROM IP: ".blue,req.clientIp.green);
      console.log('Usuario:'.blue,userId.yellow);
      console.log("---------------------------------------------------------------".magenta);

      const result = await EventService.getTickets(userId);

      if (result) {
        const o9RnDQ = generateKey();
        const Pm5dJk = encrypt(String(result.userTicket.tickets),o9RnDQ);
        const rTcc53 = encrypt(String(result.userTicketOro.tickets),o9RnDQ);

        return res.status(200).json({o9RnDQ,Pm5dJk,rTcc53});
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }


 /* async getTicketsEvents(req, res) {

    try {
      console.log("TICKETS EVENT USER - FROM IP: ".blue,req.clientIp.green);
      const {b7Yx9Q,v8Lw2Z,IODLas} = req.body;

      const userId = decrypt(v8Lw2Z,b7Yx9Q);
      const event = Number(decrypt(IODLas,b7Yx9Q));
      console.log('USER:'.blue,userId.yellow);

      const result = await EventService.getTicketsEvents(userId,event);

      if (result) {
        const o9RnDQ = generateKey();
        const Pm5dJk = encrypt(String(result.tickets),o9RnDQ);

        return res.status(200).json({o9RnDQ,Pm5dJk});
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }*/

  async getSlots(req, res) {

    try {
      console.log("SLOTS USER - FROM IP: ".blue,req.clientIp.green);
      const {b7Yx9Q,v8Lw2Z} = req.body;

      const userId = decrypt(v8Lw2Z,b7Yx9Q);    
      console.log('USER:'.blue,userId.yellow);

      const result = await EventService.getSlots(userId);

      if (result) {
        const PPIFmi = generateKey();
        const SSIDm8 = encrypt(String(90-result.dataValues.slots),PPIFmi);

        return res.status(200).json({PPIFmi,SSIDm8});
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async redeemTicketAndReward(req, res) {
    try {
      
      // console.log("REDEEM PRIZES - FROM IP: ".blue,req.clientIp.green);

      //enviar otro key para comparar...
      const { W4aRzY,/*K2tFvE,T7hLpW,*/j1xYbZ,ip } = req.body;

      console.log("---------------------------------------------------------------".magenta);
      console.log("JUGANDO.... - FROM IP: ".blue,ip.magenta);

      //const signature = K2tFvE;

      //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
      
      // Calcula un resumen de los datos recibidos
      const receivedDataHash = calculateDataHash(W4aRzY);
      // Compara el resumen de los datos recibidos con el resumen incluido en los datos
      const isDataIntegrityValid = receivedDataHash === j1xYbZ;

      const { TuVjKl,EeF789,GhIjKl,qF7z2N,f4rDnT,BSSIMO,LLODKF,FLGMDN,MTORLD } = W4aRzY;

      //console.log("DATA:",W4aRzY);
      //console.log(signature);
      //console.log("VER:",ver);
      console.log("Integridad del paquete:".magenta,isDataIntegrityValid ? String(isDataIntegrityValid).green :  String(isDataIntegrityValid).red);

      const key = TuVjKl;
      const key2 = decrypt(qF7z2N,key);

      const type = Number(decrypt(f4rDnT,key)); //tipo de evento

      const id = decrypt(EeF789,key);
      const id2 = decrypt(decrypt(GhIjKl,key),key);
      console.log('Usuario:'.blue,id.yellow);

      switch (type) {
        case 1:
          console.log('Evento:'.blue,'CountDown'.red);
          break;
        case 2: 
          console.log('Evento:'.blue,'Ruleta'.red);
          break;
        case 3: 
          console.log('Evento:'.blue,'Reto de nivel'.red);
          break;
        default:
          break;
      }

      const token = decrypt(LLODKF,key);

      const tknGame = decrypt(MTORLD,key);

      const opcion = Number(decrypt(FLGMDN,key));

      const modalidad = Number(decrypt(BSSIMO,key)); //segun el evento, es 0 si no hay modalidad

      const paramsString = `${EeF789}-${GhIjKl}-${TuVjKl}-${qF7z2N}-${f4rDnT}-${BSSIMO}-${LLODKF}-${FLGMDN}-${MTORLD}`;

      const result = await EventService.playGameSelector(tknGame,opcion,token,modalidad,type,isDataIntegrityValid,paramsString,id,id2,key,key2, req);

      console.log("---------------------------------------------------------------".magenta);

      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error al realizar la operación:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async redeemAllPrizesEvent(req, res) {
    try {

      console.log("REDEEM PRIZES EVENT - FROM IP: ".blue,req.clientIp.green);

      //enviar otro key para comparar...
      const { W4aRzY,/*K2tFvE,T7hLpW,*/j1xYbZ } = req.body;

      //const signature = K2tFvE;

      //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
      
      // Calcula un resumen de los datos recibidos
      const receivedDataHash = calculateDataHash(W4aRzY);
      // Compara el resumen de los datos recibidos con el resumen incluido en los datos
      const isDataIntegrityValid = receivedDataHash === j1xYbZ;

      const { TuVjKl,AMSKDS,PoRmNo,EeF789,GhIjKl } = W4aRzY;

      //console.log("DATA:",W4aRzY);
      //console.log(signature);
      //console.log("VER:",ver);
      console.log("HASH:",isDataIntegrityValid);

      const key = TuVjKl;
      const token = decrypt(AMSKDS,key);
      const authGame = decrypt(PoRmNo,key);
      const user = decrypt(EeF789,key);
      const type = Number(decrypt(GhIjKl,key));

      const paramsString = `${PoRmNo}-${EeF789}-${GhIjKl}-${TuVjKl}-${AMSKDS}`;

      const result = await EventService.redeemAllPrizesEvent(token,user,authGame,type,isDataIntegrityValid,paramsString, req);

      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error al realizar la operación:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async decreaseTickets(req, res) {
    try {

      console.log("DECREASE TICKETS- FROM IP: ".blue,req.clientIp.green);

      //enviar otro key para comparar...
      const { W4aRzY,/*K2tFvE,T7hLpW,*/j1xYbZ } = req.body;

      //const signature = K2tFvE;

      //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
      
      // Calcula un resumen de los datos recibidos
      const receivedDataHash = calculateDataHash(W4aRzY);
      // Compara el resumen de los datos recibidos con el resumen incluido en los datos
      const isDataIntegrityValid = receivedDataHash === j1xYbZ;

      const { MOLjPO,OPJKOU,UIODMM,TKDNS } = W4aRzY;

      //console.log("DATA:",W4aRzY);
      //console.log(signature);
      //console.log("VER:",ver);
      console.log("HASH:",isDataIntegrityValid);

      const key = MOLjPO;
      const user = decrypt(OPJKOU,key);
      const type = decrypt(UIODMM,key);
      const token = decrypt(TKDNS,key);

      const paramsString = `${MOLjPO}-${OPJKOU}-${UIODMM}-${TKDNS}`;

      const result = await EventService.decreaseTickets(token,type,user,isDataIntegrityValid,paramsString, req);

      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error al realizar la operación:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async setPartida(req, res) {
    try {

      //enviar otro key para comparar...
      const { W4aRzY,/*K2tFvE,T7hLpW,*/j1xYbZ } = req.body;

      //const signature = K2tFvE;

      //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
      
      // Calcula un resumen de los datos recibidos
      const receivedDataHash = calculateDataHash(W4aRzY);
      // Compara el resumen de los datos recibidos con el resumen incluido en los datos
      const isDataIntegrityValid = receivedDataHash === j1xYbZ;

      const { MOLjPO,OPJKOU,OLPOKK,MKUID,OIDOL,MKLOIJ,MTODLA } = W4aRzY;

      //console.log("DATA:",W4aRzY);
      //console.log(signature);
      //console.log("VER:",ver);
      console.log("HASH:",isDataIntegrityValid);

      const key = MOLjPO;
      const user = decrypt(OPJKOU,key);
      const token = decrypt(OLPOKK,key);
      const estado = Number(decrypt(MKUID,key));// 0 borrar, 1 insertar, 2 buscar
      const type = Number(decrypt(MKLOIJ,key));
      const authGame = decrypt(MTODLA,key)
      const index = Number(decrypt(OIDOL,key));

      const paramsString = `${MOLjPO}-${OPJKOU}-${OLPOKK}-${MKUID}-${MKLOIJ}-${OIDOL}-${MTODLA}`;

      console.log("---------------------------------------------------------------".magenta);
      console.log("PARTIDA - FROM IP: ".blue,req.clientIp.green);
      console.log('Usuario:'.blue,user.yellow);

       switch (Number(type)) {
        case 4:
          console.log('Evento:'.blue,'Buscaminas'.red);
          break;
        case 5: 
          console.log('Evento:'.blue,'Hot Slot'.red);
          break;
        default:
          console.log('Evento:'.blue,'....'.red);
          break;
      }

      switch (Number(estado)) {
        case 0:
          console.log('Estado de evento:'.blue,'Partida terminada... [Eliminar]'.red);
          break;
        case 1: 
          console.log('Estado de evento:'.blue,'Actualizar o crear partida'.red);
          break;
        case 2: 
          console.log('Estado de evento:'.blue,'Obtener partida'.red);
          break;
        default:
          break;
      }

      const result = await EventService.setPartida(authGame,token,type,index,user,estado,isDataIntegrityValid,paramsString, req);

       console.log("---------------------------------------------------------------".magenta);
      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error al realizar la operación:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async redeemCupon(req, res) {
    try {

      console.log("REDEEM CUPON - FROM IP: ".blue,req.clientIp.green);

      //enviar otro key para comparar...
      const { TEMDLa,/*K2tFvE,T7hLpW,*/TIIDsK } = req.body;

      //const signature = K2tFvE;

      //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
      
      // Calcula un resumen de los datos recibidos
      const receivedDataHash = calculateDataHash(TEMDLa);
      // Compara el resumen de los datos recibidos con el resumen incluido en los datos
      const isDataIntegrityValid = receivedDataHash === TIIDsK;

      const { KIddmL,USIDA4,GMTDDs,IODKSD } = TEMDLa;

      //console.log("DATA:",W4aRzY);
      //console.log(signature);
      //console.log("VER:",ver);
      console.log("HASH:",isDataIntegrityValid);

      const key = KIddmL;
      const user = decrypt(USIDA4,key);
      const token = decrypt(IODKSD,key);
      const cupon = decrypt(GMTDDs,key);

      const paramsString = `${KIddmL}-${USIDA4}-${GMTDDs}-${IODKSD}`;

      const result = await EventService.redeemCupon(paramsString,token,user,cupon,isDataIntegrityValid, req);

      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error al realizar la operación:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async buyTickets(req, res) {
    try {

      const { y6uGvQ, I3eSkR } = req.body;

      // Calcula un resumen de los datos recibidos
      const receivedDataHash = calculateDataHash(y6uGvQ);
      // Compara el resumen de los datos recibidos con el resumen incluido en los datos
      const isDataIntegrityValid = receivedDataHash === I3eSkR;

      const { qF7z2N, W4aRzY, j1xYbZ ,CCIOMD,TKDNS } = y6uGvQ;

      const key = j1xYbZ;

      const ticketCount = Number(decrypt(W4aRzY,key));

      const userId = decrypt(qF7z2N,key);

      const paramsString = `${qF7z2N}-${W4aRzY}-${j1xYbZ}-${CCIOMD}-${TKDNS}`;

      const typePay = decrypt(CCIOMD,key);
      const token = decrypt(TKDNS,key);

      console.log("---------------------------------------------------------------".magenta);
      console.log("BUY TICKETS (GIROS) - FROM IP: ".blue,req.clientIp.green);
      console.log('Usuario:'.blue,userId.yellow);
      // console.log("HASH:",isDataIntegrityValid);
      console.log("Integridad del paquete:".magenta,isDataIntegrityValid ? String(isDataIntegrityValid).green :  String(isDataIntegrityValid).red);

      //const typePay = decrypt(CCIOMD,key) === 'cash' ? 1 : (decrypt(CCIOMD,key) === 'gold' ? 2 : null);

      //onsole.log(typePay);
      //console.log(decrypt(CCIOMD,key));

      //console.log(paramsString);

      const result = await EventService.buyTickets(typePay,isDataIntegrityValid,paramsString,userId,ticketCount,token,req);
  
      console.log("---------------------------------------------------------------".magenta);
      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error al realizar la compra de tickets:', error);
      return res.status(500).json({error: 'Error interno del servidor'});
    }
  }  

  async getAllPrizesGames(req, res) {
    try {
      const { K2tFvE, A9sCqD } = req.body;

      const type = Number(decrypt(A9sCqD,K2tFvE));

      const roulettePrizes = await EventService.getAllPrizesGames(type);

      const mNoABC = generateKey();
      const DeFgHI = encrypt(JSON.stringify(roulettePrizes),mNoABC);
      res.status(200).json({mNoABC,DeFgHI});
    } catch (error) {
      console.error('Error al obtener los premios de la ruleta:', error.message);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async verifyToken(req, res) {
    try {
      const { IOU9jO,MIOhKK, IOJKOl } = req.body;

      const user = decrypt(MIOhKK,IOU9jO);
      const token = decrypt(IOJKOl,IOU9jO);

      const result = await EventService.verifyToken(user,token);

      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error al obtener los premios de la ruleta:', error.message);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async setAuthGame(req, res) {
    try {

      //enviar otro key para comparar...
      const { token,user,game } = req.body;

      console.log("---------------------------------------------------------------".magenta);
      console.log("SET TOKEN DE JUEGO - FROM IP: ".blue,req.clientIp.green);
      console.log('Usuario:'.blue,user.yellow);
      switch (Number(game)) {
        case 1:
          console.log('Evento:'.blue,'CountDown'.red);
          break;
        case 2: 
          console.log('Evento:'.blue,'Ruleta'.red);
          break;
        default:
          break;
      }
      console.log("---------------------------------------------------------------".magenta);

      const result = await EventService.setAuthGame(token,user,Number(game));

      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error al realizar la operación:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async getPieceAndChest(req, res, next) {
    try {
      const { user,token } = req.body;

      const dataGame = await EventService.getPieceAndChest(user,token);
      //console.log(ranking);

      if (dataGame.success || dataGame.code) {
        return res.status(200).json(dataGame);
      } else {
        return res.status(400).json(dataGame);
      }
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async obtenerNuevaPieza(req, res, next) {
    try {
      const { user,token } = req.body;

      const dataGame = await EventService.obtenerNuevaPieza(user,token);
      //console.log(ranking);

      if (dataGame.success || dataGame.code) {
        return res.status(200).json(dataGame);
      } else {
        return res.status(400).json(dataGame);
      }
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async obtenerCofre(req, res, next) {
    try {
      const { user,token } = req.body;

      const dataGame = await EventService.obtenerCofre(user,token);
      //console.log(ranking);

      if (dataGame.success || dataGame.code) {
        return res.status(200).json(dataGame);
      } else {
        return res.status(400).json(dataGame);
      }
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async obtenerTodos(req, res, next) {
    try {
      const eventos = await EventService.obtenerTodos();
      //console.log(ranking);

      return res.status(200).json(eventos);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async setPersonaje(req, res, next) {
    try {
      const { user,token,character } = req.body;

      const response = await EventService.setPersonaje(user,token,character);
      //console.log(ranking);

      if (response.success || response.code) {
        return res.status(200).json(response);
      } else {
        return res.status(400).json(response);
      }
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}

export default new EventController();
