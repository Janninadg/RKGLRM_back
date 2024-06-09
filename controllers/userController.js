import UserService from '../services/userService.js';
import { verifyToken } from '../utils/authUtils.js';
import { encrypt, decrypt, generateKey } from '../helpers/encryption.js';
import colors from "colors";
import { calculateDataHash } from '../helpers/signedData.js';

class UserController {
  async getAllUsers(req, res, next) {
    /*const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token no proporcionado o inválido' });
    }

    const token = authHeader.split(' ')[1];*/

    try {
      //const decodedToken = await verifyToken(token); // Aquí se verifica el token JWT
      // Aquí puedes acceder a decodedToken.id para obtener el ID del usuario autenticado

      // Si lo deseas, puedes implementar lógica adicional para comprobar roles, permisos, etc.

      const users = await UserService.getAllUsers();
      return res.status(200).json(users);
    } catch (error) {
      return next(error);
    }
  }

  // Obtener datos de usuario por ID
  async getUserById(req, res) {
    try {
      const userId = req.params.id;
      const user = await UserService.getUserById(userId);
      
      if (user) {
        const key = generateKey();
        const encryptedUserData = encrypt(JSON.stringify(user), key);
        return res.status(200).json({ UCIUD:encryptedUserData, MUIDDR:key });
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

    } catch (error) {
      res.status(500).json({ error: 'Error al obtener datos de usuario por ID' });
    }
  }

  // Obtener rate exchange
  async getExchangeRate(req, res) {
    try {
      const type = await UserService.getExchangeRate();
      
      if (type) {
        const key = generateKey();
        const tipocambio = encrypt(String(type), key);
        return res.status(200).json({ RPTKDL:tipocambio, RPGLDD:key });
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

    } catch (error) {
      res.status(500).json({ error: 'Error al obtener datos de usuario por ID' });
    }
  }

  //exhange
  async exchangeCash(req, res) {
    try {

      console.log("EXCHANGE CASH TO ORO - FROM IP: ".blue,req.clientIp.green);

      //enviar otro key para comparar...
      const { W4aRzY,/*K2tFvE,T7hLpW,*/j1xYbZ } = req.body;

      //const signature = K2tFvE;

      //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
      
      // Calcula un resumen de los datos recibidos
      const receivedDataHash = calculateDataHash(W4aRzY);
      // Compara el resumen de los datos recibidos con el resumen incluido en los datos
      const isDataIntegrityValid = receivedDataHash === j1xYbZ;

      const { MTPDKL,TOODLs,SUIDCM,MapSKD } = W4aRzY;

      //console.log("DATA:",W4aRzY);
      //console.log(signature);
      //console.log("VER:",ver);
      console.log("HASH:",isDataIntegrityValid);

      const key = MTPDKL;
      const user = decrypt(TOODLs,key);

      const token = decrypt(SUIDCM,key);

      const cash = Number(decrypt(MapSKD,key)); 


      const paramsString = `${MTPDKL}-${TOODLs}-${SUIDCM}-${MapSKD}`;

      const result = await UserService.exchangeCash(key,user,token,cash,isDataIntegrityValid,paramsString, req);

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

  // Obtener el gold de un usuario por ID
  async getUserGold(req, res) {
    const userId = req.params.id;

    try {
      const gold = await UserService.getUserGoldById(userId);

      if (gold !== null) {
        const key = generateKey();
        const encryptedGold = encrypt(gold.toString(), key);
        return res.status(200).json({ IOMJKL: encryptedGold, SHUTDI:key });
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Error al obtener el gold del usuario:', error);
      return res.status(500).json({ message: 'Error en el servidor' });
    }
  }

  async getUserIdByUsername(req, res, next) {
    const { name } = req.params;

    try {
      const userId = await UserService.getUserIdByUsername(name);

      if (userId) {
        const key = generateKey();
        const encryptedId = encrypt(userId.toString(), key);

        return res.status(200).json({ BIHOI: encryptedId, KMIOUL:key  });
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Error al obtener el id de usuario:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async getCashByUserId(req, res) {
    const id = req.params.id;

    try {
      const cash = await UserService.getCashByUserId(id);

      if (cash !== null) {
        const key = generateKey();
        const encryptedCash = encrypt(cash.toString(), key);
        return res.status(200).json({ MOCHUI: encryptedCash, POILDS:key });
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Error al obtener el cash del usuario:', error);
      return res.status(500).json({ message: 'Error en el servidor' });
    }
  }

  async registerUser(req, res, next) {

    console.log("---------------------------------------------------------------".blue);
    console.log("NEW REGISTER - FROM IP: ".blue,req.clientIp.green);
    const { uYz3Tk, mS5bAt, iGqP1O, vFwR9Z,chrw,ip } = req.body;

    const username = decrypt(mS5bAt,uYz3Tk);
    const password = decrypt(iGqP1O,uYz3Tk);
    const phoneNumber = decrypt(vFwR9Z,uYz3Tk);

    console.log('Usuario:'.blue,username.yellow);
    // console.log("---------------------------------------------------------------".blue);

  
    try {
      const result = await UserService.registerUser(req,username, password, phoneNumber,chrw,ip);

      console.log('¿Success? :'.blue,result.success);
      console.log("---------------------------------------------------------------".blue);

      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error al registrar el usuario:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async getProfile(req, res, next) {

    console.log("GET PROFILE USER - FROM IP: ".blue,req.clientIp.green);

    const { name,token } = req.params; // Obtener el nombre de usuario de los parámetros de la ruta

    console.log('USER:'.blue,name.yellow);
  
    try {
      const profileData = await UserService.getProfileService(name,token);
      if(profileData.code){
        return res.status(200).json(profileData);
      } else{
        const XyZ456 = generateKey();
        const pQr789 = encrypt(JSON.stringify(profileData),XyZ456);

        return res.status(200).json({XyZ456,pQr789});
      }
    } catch (error) {
      console.error('Error al obtener el perfil:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async getRanking(req, res, next) {
    try {
      const ranking = await UserService.getRanking();
      //console.log(ranking);

      const MNFoeO = generateKey();
      const TdkfEO = encrypt(JSON.stringify(ranking), MNFoeO);

      return res.status(200).json({ MNFoeO, TdkfEO });
    } catch (error) {
      console.error('Error al obtener el ranking:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async getTickets(req, res) {

    try {
      console.log("TICKETS STAGES USER - FROM IP: ".blue,req.clientIp.green);
      const {b7Yx9Q,v8Lw2Z,TUIEMd,rEcI4} = req.body;

      const userId = decrypt(v8Lw2Z,b7Yx9Q);
      const type = Number(decrypt(TUIEMd,b7Yx9Q));
      const mode = Number(decrypt(rEcI4,b7Yx9Q));

      console.log('USER:'.blue,userId.yellow);

      const result = await UserService.getTickets(userId,type,mode);

      if (result) {
        const o9RnDQ = generateKey();
        const Pm5dJk = encrypt(String(result.tickets),o9RnDQ);
        //const rTcc53 = encrypt(String(result.userTicketOro.tickets),o9RnDQ);

        return res.status(200).json({o9RnDQ,Pm5dJk});
      } else {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Error al obtener la cantidad de tickets:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  async resetStage(req, res) {
    try {

      console.log("RESET STAGE - FROM IP: ".blue,req.clientIp.green);

      //enviar otro key para comparar...
      const { W4aRzY,/*K2tFvE,T7hLpW,*/j1xYbZ } = req.body;

      //const signature = K2tFvE;

      //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
      
      // Calcula un resumen de los datos recibidos
      const receivedDataHash = calculateDataHash(W4aRzY);
      // Compara el resumen de los datos recibidos con el resumen incluido en los datos
      const isDataIntegrityValid = receivedDataHash === j1xYbZ;

      const { MOLjPO,OPJKOU,UIODMM,MFLDOO } = W4aRzY;

      //console.log("DATA:",W4aRzY);
      //console.log(signature);
      //console.log("VER:",ver);
      console.log("HASH:",isDataIntegrityValid);

      const key = MOLjPO;
      const user = decrypt(OPJKOU,key);
      const token = decrypt(MFLDOO,key);
      const idStage = Number(decrypt(UIODMM,key));
      //const type = Number(decrypt(UIODMM,key));

      const paramsString = `${MOLjPO}-${OPJKOU}-${UIODMM}-${MFLDOO}`;

      const result = await UserService.resetStage(token,idStage,user,isDataIntegrityValid,paramsString, req);

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
}

export default new UserController();
