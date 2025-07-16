import RefineriaService from '../services/refineriaService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";

class RefineriaController {

    async getInventory(req, res, next) {
        try {
          const { user,token } = req.body;
    
          const response = await RefineriaService.getInventory(user,token);
          //console.log(ranking);
    
          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al obtener inventario:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

       async getHistory(req, res, next) {
        try {
          const { user,token } = req.body;
    
          const response = await RefineriaService.getHistoryRefinery(user,token);
          //console.log(ranking);
    
          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al obtener historial:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }


      async refinyItem(req, res, next) {
        try {
          const { user,token,assetid,idi,slot,itemid } = req.body;

          
          console.log("---------------------------------------------------------------".cyan);
          console.log("REFINERÍA - FROM IP: ".blue,req.clientIp.magenta);
          console.log('Usuario:'.magenta,user.blue);

          const response = await RefineriaService.refinyItem(user,token,assetid,idi,slot,itemid);
          //console.log(ranking);
    
          console.log("---------------------------------------------------------------".cyan);
          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al obtener inventario:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }
}

export default new RefineriaController();
