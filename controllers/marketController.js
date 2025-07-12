import MarketService from '../services/marketService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";

class MarketController {
    async buyItems(req, res, next) {
        try {
          const { user,token,idmarket,ip } = req.body;
    
          console.log("---------------------------------------------------------------".cyan);
          console.log("MARKETPLACE (COMPRA) - FROM IP: ".cyan,ip.green);
          console.log('Usuario:'.cyan,user.magenta);
          console.log('ID Market:'.cyan,String(idmarket).magenta);
          const response = await MarketService.buyItems(user,token,idmarket);
          //console.log(ranking);

        
          console.log("---------------------------------------------------------------".cyan);
    
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

    async returnItem(req, res, next) {
      try {
        const { user,token,idmarket,ip } = req.body;
  
        console.log("---------------------------------------------------------------".cyan);
        console.log("MARKETPLACE (RETORNO) - FROM IP: ".cyan,ip.green);
        console.log('Usuario:'.cyan,user.magenta);
        console.log('ID Market:'.cyan,String(idmarket).magenta);
        const response = await MarketService.returnItem(user,token,idmarket);
        //console.log(ranking);

      
        console.log("---------------------------------------------------------------".cyan);
  
        if (response.success || response.code) {
          return res.status(200).json(response);
        } else {
          return res.status(400).json(response);
        }
      } catch (error) {
        console.error('Error al retornar item:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
    }

    async sellItem(req, res, next) {
      try {
        const { user,token,id,price,currency,ip } = req.body;
  
        console.log("---------------------------------------------------------------".cyan);
        console.log("MARKETPLACE (VENTA) - FROM IP: ".cyan,ip.green);
        console.log('Usuario:'.cyan,user.magenta);
        // console.log('ID Market:'.cyan,String(id).magenta);
        const response = await MarketService.sellItem(user,token,id,price,currency);
        //console.log(ranking);

      
        console.log("---------------------------------------------------------------".cyan);
  
        if (response.success || response.code) {
          return res.status(200).json(response);
        } else {
          return res.status(400).json(response);
        }
      } catch (error) {
        console.error('Error al vender item:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
  }

    async getHistoryPucharse(req, res, next) {
        try {
          const { user,token } = req.body;
    
          const response = await MarketService.getHistoryPucharse(user,token);
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

    async getHistorySells(req, res, next) {
      try {
        const { user,token } = req.body;
  
        const response = await MarketService.getHistorySells(user,token);
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
    
          const response = await MarketService.getItems();
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

    async getParams(req, res, next) {
      try {
      //   const { user,token } = req.body;
  
        const response = await MarketService.getParams();
        //console.log(ranking);
  
        if (response.success || response.code) {
          return res.status(200).json(response);
        } else {
          return res.status(400).json(response);
        }
      } catch (error) {
        console.error('Error al obtener Parametros:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
  }
}

export default new MarketController();
