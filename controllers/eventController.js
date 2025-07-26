import EventService from '../services/eventService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";

class EventController {

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
 

  

 
}

export default new EventController();