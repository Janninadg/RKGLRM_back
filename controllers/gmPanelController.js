import GMPanelService from '../services/gmPanelService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";

class GMPanelController {

    async verifyIs(req, res) {
        try {
          const { cmVSmm, USIDpk } = req.body;

          console.log("VERIFY IS GM - FROM IP: ".blue,req.clientIp.green);
    
          const user = decrypt(USIDpk,cmVSmm);

          console.log('USER:'.blue,user.yellow);
    
          const result = await GMPanelService.verifyIsGM(user);

          console.log('¿IS GM?:'.blue,result.yellow);
    
          const OPSKDa = generateKey();
          const ITDKLS = encrypt(result,OPSKDa);

          res.status(200).json({OPSKDa,ITDKLS});
        } catch (error) {
          console.error('Error al verificar si es GM:', error.message);
          res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

      async banUsers(req, res) {
        try {
    
          //enviar otro key para comparar...
          const { IDODUI,/*K2tFvE,T7hLpW,*/jMdiOl } = req.body;
    
          //const signature = K2tFvE;
    
          //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
          
          // Calcula un resumen de los datos recibidos
          const receivedDataHash = calculateDataHash(IDODUI);
          // Compara el resumen de los datos recibidos con el resumen incluido en los datos
          const isDataIntegrityValid = receivedDataHash === jMdiOl;
    
          const { OPPSLd,TYOsmD,ATLSMd,IUR99L } = IDODUI;
    
          //console.log("DATA:",W4aRzY);
          //console.log(signature);
          //console.log("VER:",ver);
          console.log("HASH:",isDataIntegrityValid);
    
          const key = OPPSLd;
          const data = JSON.parse(decrypt(TYOsmD,key));
    
          const user = decrypt(ATLSMd,key);
          const token = decrypt(IUR99L,key);
    
          const paramsString = `${OPPSLd}-${TYOsmD}-${ATLSMd}-${IUR99L}`;

          console.log("[GM Panel]".green,' Baneo de usuarios'.green);
    
          const result = await GMPanelService.banUsers(token,data,user,isDataIntegrityValid,paramsString, req);
    
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

      async recargaCash(req, res) {
        try {
    
          //enviar otro key para comparar...
          const { IDODUI,/*K2tFvE,T7hLpW,*/jMdiOl } = req.body;
    
          //const signature = K2tFvE;
    
          //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
          
          // Calcula un resumen de los datos recibidos
          const receivedDataHash = calculateDataHash(IDODUI);
          // Compara el resumen de los datos recibidos con el resumen incluido en los datos
          const isDataIntegrityValid = receivedDataHash === jMdiOl;
    
          const { SIDMCS,O0gDPD,cMDIfe,MUDKFF } = IDODUI;
    
          //console.log("DATA:",W4aRzY);
          //console.log(signature);
          //console.log("VER:",ver);
          // console.log("HASH:",isDataIntegrityValid);
    
          const key = SIDMCS;
          const data = JSON.parse(decrypt(O0gDPD,key));
    
          const user = decrypt(cMDIfe,key);
          const token = decrypt(MUDKFF,key);
    
          const paramsString = `${SIDMCS}-${O0gDPD}-${cMDIfe}-${MUDKFF}`;

          console.log("[GM Panel]".green,' Recarga/Descuento'.white,(' - Admin: '+user).white);
    
          const result = await GMPanelService.recargaCash(token,data,user,isDataIntegrityValid,paramsString, req);
    
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

      async setCupon(req, res) {
        try {
    
          console.log("GENERAR CUPON - FROM IP: ".blue,req.clientIp.green);
    
          //enviar otro key para comparar...
          const { IDODUI,/*K2tFvE,T7hLpW,*/jMdiOl } = req.body;
    
          //const signature = K2tFvE;
    
          //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
          
          // Calcula un resumen de los datos recibidos
          const receivedDataHash = calculateDataHash(IDODUI);
          // Compara el resumen de los datos recibidos con el resumen incluido en los datos
          const isDataIntegrityValid = receivedDataHash === jMdiOl;
    
          const { ODALSC,IUIDSD,cJDKIO,MDIO3e } = IDODUI;
    
          //console.log("DATA:",W4aRzY);
          //console.log(signature);
          //console.log("VER:",ver);
          console.log("HASH:",isDataIntegrityValid);
    
          const key = ODALSC;
          const data = JSON.parse(decrypt(IUIDSD,key));
    
          const token = decrypt(MDIO3e,key);
          const user = decrypt(cJDKIO,key);
    
          const paramsString = `${ODALSC}-${IUIDSD}-${cJDKIO}-${MDIO3e}`;
    
          const result = await GMPanelService.setCupon(token,data,user,isDataIntegrityValid,paramsString, req);
    
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

      async login(req, res, next) {

        console.log("LOGIN - FROM IP: ".blue,req.clientIp.green);
        console.log("LOGIN - FROM IPv4: ".blue,req.socket.remoteAddress.green);
    
        const { user,pass } = req.body;
        console.log('USER:'.blue,user.yellow);
    
        try {
          const userres = await GMPanelService.login(req,user, pass);
          //console.log(user);
          if (userres.success || userres.code) {
            return res.status(200).json(userres);
          } else {
            return res.status(400).json(userres);
          }
        } catch (error) {
          return next(error);
        }
      }

      async logout(req, res, next) {

        console.log("LOGOUT - FROM IP: ".blue,req.clientIp.green);
        console.log("LOGOUT - FROM IPv4: ".blue,req.socket.remoteAddress.green);
    
        const { user,token } = req.body;
        console.log('USER:'.blue,user.yellow);
    
        try {
          const userres = await GMPanelService.logout(user, token);
          //console.log(user);
          if (userres.success || userres.code) {
            return res.status(200).json(userres);
          } else {
            return res.status(400).json(userres);
          }
        } catch (error) {
          return next(error);
        }
      }

      async getUserstoBan(req, res, next) {
        try {
          const { user,token } = req.body;

          const users = await GMPanelService.getUserstoBan(user,token);
          //console.log(ranking);

          if (users.success || users.code) {
            return res.status(200).json(users);
          } else {
            return res.status(400).json(users);
          }
        } catch (error) {
          console.error('Error al obtener usuarios:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

      async getUsersName(req, res, next) {
        try {
          const { user,token } = req.body;

          const response = await GMPanelService.getUsersName(user,token);
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

      async giftPowerUser(req, res, next) {
        try {
          const { user,token,dias,usuarios } = req.body;

          const response = await GMPanelService.giftPowerUser(user,token,dias,usuarios );
          //console.log(response);

          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al otorgar poweruser:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

      async getPersonajes(req, res, next) {
        try {
          const { user,token } = req.body;

          const response = await GMPanelService.getPersonajes(user,token);
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

      async setLevel(req, res, next) {
        try {
          const { user,token,level,personajes } = req.body;

          const response = await GMPanelService.setLevel(user,token,level,personajes );
          //console.log(response);

          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al otorgar poweruser:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

      async getClanes(req, res, next) {
        try {
          const { user,token } = req.body;

          const response = await GMPanelService.getClanes(user,token);
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

      async createClan(req, res, next) {
        try {
          const { user,token,clan,master,members } = req.body;

          const response = await GMPanelService.createClan(user,token,clan,master,members);
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

      async addMembers(req, res, next) {
        try {
          const { user,token,idClan,members } = req.body;

          const response = await GMPanelService.addMembers(user,token,idClan,members);
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

      async getLogs(req, res, next) {
        try {
          const { user,token, } = req.body;

          const response = await GMPanelService.getLogs(user,token);
          //console.log(response);

          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al obtener logs:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

}

export default new GMPanelController();
