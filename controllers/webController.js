import WebService from '../services/webService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";

class WebController {

    async getLinks(req, res, next) {
        try {
          const links = await WebService.getLinks();
          //console.log(ranking);
    
          //const MNFoeO = generateKey();
          //const TdkfEO = encrypt(JSON.stringify(ranking), MNFoeO);
    
          return res.status(200).json(links);
        } catch (error) {
          console.error('Error al obtener los links:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

      async getBuyAssets(req, res, next) {
        try {
          const byai = await WebService.getBuyAssets();
          //console.log(ranking);
    
          //const MNFoeO = generateKey();
          //const TdkfEO = encrypt(JSON.stringify(ranking), MNFoeO);
    
          return res.status(200).json(byai);
        } catch (error) {
          console.error('Error al obtener los assets:', error);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

}

export default new WebController();
