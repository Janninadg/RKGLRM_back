import MarketService from '../services/marketService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";
import { enviarMensajeACliente, obtenerClientesActivos } from '../socket/socketServer.mjs';

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

    async initChatTrade(req, res, next) {
      try {
        const { user, token, idmarket, ip } = req.body;

        console.log("---------------------------------------------------------------".cyan);
        console.log("TRADE (INIT CHAT) - FROM IP: ".cyan, ip.green);
        console.log('Usuario:'.cyan, user.magenta);
        console.log('ID Market:'.cyan, String(idmarket).magenta);

        const response = await MarketService.initChatTrade(user, token, idmarket);

        console.log("---------------------------------------------------------------".cyan);

        if (response.success || response.code) {
          return res.status(200).json(response);
        } else {
          return res.status(400).json(response);
        }
      } catch (error) {
        console.error('Error en initChatTrade:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
    }

    async submitTradeRating(req, res, next) {
      try {
        const { user, auth, chat_id, rating, review, user_reviewed, ip } = req.body;

        console.log("---------------------------------------------------------------".cyan);
        console.log("TRADE (SUBMIT RATING) - FROM IP: ".cyan, ip?.green);
        console.log("Rater:".cyan, String(user).magenta);
        console.log("User reviewed:".cyan, user_reviewed.magenta);
        console.log("---------------------------------------------------------------".cyan);

        // Llamar al servicio donde se determina automáticamente:
        // - si el rater es buyer o seller
        // - quién es target
        // - qué rol se evalúa (BUYER o SELLER)
        const response = await MarketService.submitRating({
          user,
          token: auth,
          chat_id,
          rating,
          review,
          user_reviewed
        });

        console.log(response);
        if (response.success || response.code ) {
          return res.status(200).json(response);
        } else {
          return res.status(400).json(response);
        }

      } catch (error) {
        console.error("Error en submitTradeRating:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
      }
    }

    async getChat(req, res, next) {
    try {
      const { user, token, chat, ip } = req.body;

      console.log("---------------------------------------------------------------".cyan);
      console.log("TRADE (GET CHAT) - FROM IP: ".cyan, ip.green);
      console.log("Usuario:".cyan, user.magenta);
      console.log("Chat ID:".cyan, String(chat).magenta);

      const response = await MarketService.getChat(user, token, chat);

      console.log("---------------------------------------------------------------".cyan);

      if (response.success || response.code) {
        return res.status(200).json(response);
      } else {
        return res.status(400).json(response);
      }
    } catch (error) {
      console.error("Error en getChat:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

  async getUserChats(req, res, next) {
    try {
      const { user, token, ip } = req.body;

      console.log("---------------------------------------------------------------".cyan);
      console.log("TRADE (GET USER CHATS) - FROM IP: ".cyan, ip.green);
      console.log("Usuario:".cyan, user.magenta);

      // Llamamos al servicio
      const response = await MarketService.getUserChats(user, token);

      console.log("---------------------------------------------------------------".cyan);

      // Misma lógica de retorno que tu ejemplo
      if (response.success || response.code) {
        return res.status(200).json(response);
      } else {
        return res.status(400).json(response);
      }

    } catch (error) {
      console.error("Error en getUserChats:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }

   async sendMessage(req, res) {
    try {
      const { chat_id, sender, content_type, message, auth,image } = req.body;
      const file = req.file || null;

      // Validar campos mínimos
      if (!chat_id || !sender || !auth) {
        return res.status(400).json({ success: false, code: '400', message: 'Faltan datos obligatorios' });
      }

      // Enviar al servicio
      const result = await MarketService.sendMessage({
        chat_id,
        sender,
        content_type,
        message,
        file,
        token: auth,
        image
      });

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error en sendMessage controller:', error);
      return res.status(500).json({ success: false, code: '500', message: 'Error interno del servidor' });
    }
  }

  async getHistory(req, res) {
    try {
      const { chat_id, user } = req.body;

      console.log("TRADE CHAT (HISTORY) - user:", user.magenta, "chat:", String(chat_id).magenta);

      const response = await TradeChatService.getHistory({ chat_id: Number(chat_id), user });

      return res.status(response.success ? 200 : 400).json(response);
    } catch (error) {
      console.error('Error getHistory:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
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

     async getPayments(req, res, next) {
        try {
        //   const { user,token } = req.body;
    
          const response = await MarketService.getPayments();
          //console.log(ranking);
    
          return res.status(200).json(response);
        
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
