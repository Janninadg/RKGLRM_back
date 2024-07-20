import StoreService from '../services/storeService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";

class StoreController {

    async getEventPoints(req, res, next) {
        try {
          const { user,token } = req.body;
    
          const response = await StoreService.getEventPoints(user,token);
          //console.log(ranking);
    
          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al obtener puntos de evento:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

    async buyItems(req, res, next) {
        try {
          const { user,token,idstore,amount,ip } = req.body;
    
          const response = await StoreService.buyItems(user,token,idstore,amount);
          //console.log(ranking);

          console.log("---------------------------------------------------------------".blue);
          console.log("COMPRANDO - FROM IP: ".blue,ip.green);
          console.log('Usuario:'.blue,user.yellow);
          console.log('ID Store:'.blue,String(idstore).yellow);
          console.log('Amount:'.blue,String(amount).yellow);
          console.log("---------------------------------------------------------------".blue);
    
          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al comprar item:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    async getHistoryPucharse(req, res, next) {
        try {
          const { user,token } = req.body;
    
          const response = await StoreService.getHistoryPucharse(user,token);
          //console.log(ranking);
    
          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al comprar item:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    async getItems(req, res, next) {
        try {
        //   const { user,token } = req.body;
    
          const response = await StoreService.getItems();
          //console.log(ranking);
    
          if (response.success || response.code) {
            return res.status(200).json(response);
          } else {
            return res.status(400).json(response);
          }
        } catch (error) {
          console.error('Error al obtener items de la tienda:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
}

export default new StoreController();
