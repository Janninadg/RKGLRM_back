import RefineriaService from '../services/refineriaService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";

class RefineriaController {

    async getEventPoints(req, res, next) {
        try {
          const { user,token } = req.body;
    
          const response = await RefineriaService.getEventPoints(user,token);
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
}

export default new RefineriaController();
