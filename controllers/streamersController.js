import StreamersService from '../services/streamersService.js';
import { encrypt,decrypt,generateKey } from '../helpers/encryption.js';
import { verifySignature,calculateDataHash } from '../helpers/signedData.js';
import colors from "colors";

class StreamersController {

    async verifyIs(req, res) {
        try {
          const { cmVSmm, USIDpk } = req.body;

          console.log("VERIFY IS STREAMER - FROM IP: ".blue,req.clientIp.green);
    
          const user = decrypt(USIDpk,cmVSmm);

          console.log('USER:'.blue,user.yellow);
    
          const result = await StreamersService.verifyIsStreamer(user);

          console.log('¿IS STREAMER?:'.blue,result.yellow);
    
          const STOLDD = generateKey();
          const rTdfES = encrypt(result,STOLDD);

          res.status(200).json({STOLDD,rTdfES});
        } catch (error) {
          console.error('Error al verificar si es STREAMER:', error.message);
          res.status(500).json({ error: 'Error interno del servidor' });
        }
      }

      async setCupon(req, res) {
        try {
    
          console.log("GENERAR CUPON STREAMER - FROM IP: ".blue,req.clientIp.green);
    
          //enviar otro key para comparar...
          const { IDODUI,/*K2tFvE,T7hLpW,*/jMdiOl } = req.body;
    
          //const signature = K2tFvE;
    
          //const ver = verifySignature(JSON.stringify(W4aRzY), signature, T7hLpW);
          
          // Calcula un resumen de los datos recibidos
          const receivedDataHash = calculateDataHash(IDODUI);
          // Compara el resumen de los datos recibidos con el resumen incluido en los datos
          const isDataIntegrityValid = receivedDataHash === jMdiOl;
    
          const { ODALSC,IUIDSD,cJDKIO,MUDKFF } = IDODUI;
    
          //console.log("DATA:",W4aRzY);
          //console.log(signature);
          //console.log("VER:",ver);
          console.log("HASH:",isDataIntegrityValid);
    
          const key = ODALSC;
          const data = JSON.parse(decrypt(IUIDSD,key));
    
          const token = decrypt(MUDKFF,key);
          const user = decrypt(cJDKIO,key);
    
          const paramsString = `${ODALSC}-${IUIDSD}-${cJDKIO}-${MUDKFF}`;
    
          const result = await StreamersService.setCupon(token,data,user,isDataIntegrityValid,paramsString, req);
    
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

export default new StreamersController();
