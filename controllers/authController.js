import UserService from '../services/userService.js';
import { encrypt, decrypt, generateKey } from '../helpers/encryption.js';
import colors from "colors";

class AuthController {
  async login(req, res, next) {

    console.log("LOGIN - FROM IP: ".blue,req.clientIp.green);
    console.log("LOGIN - FROM IPv4: ".blue,req.socket.remoteAddress.green);

    const { K9aCvP,xw1yZ4,Q7RdEf,OeDMFL } = req.body;
    const id = decrypt(xw1yZ4,K9aCvP);
    const password = decrypt(Q7RdEf,K9aCvP);
    const sessionActive = decrypt(OeDMFL,K9aCvP);
    console.log('USER:'.blue,id.yellow);

    try {
      const result = await UserService.login(req,id, password,sessionActive);

      if (result.success || result.code) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      return next(error);
    }
  }

  async logout(req, res) {
    try {
      console.log("LOGOUT - FROM IP: ".blue,req.clientIp.green);

      const { yW9KuQ, rDcJ7I, lNx8Ve } = req.body;

      const token = decrypt(rDcJ7I,yW9KuQ);
      const user = decrypt(lNx8Ve,yW9KuQ);
      console.log('USER:'.blue,user.yellow);

      // Llama al servicio para agregar el token a Blackout y guardar la ultima conexion
      await UserService.logout(user, token);

      // Retornar un código de éxito
      res.status(200).json({ code: '000' });
    } catch (error) {
      console.error('Error en el endpoint de logout:', error);
      res.status(500).json({ message: 'Error en el servidor.' });
    }
  }

  async renewToken(req, res, next) {
    console.log("RENEW TOKEN - FROM IP: ".blue,req.clientIp.green);

    const { kL6zMo, V1rGpH, qBwC3R } = req.body;

    const token = decrypt(kL6zMo,qBwC3R);
    const user = decrypt(V1rGpH,qBwC3R);
    
    console.log("TOKEN CONTROLLER:".blue,token.yellow);
    console.log('USER:'.blue,user.yellow);
  
    try {
      const result = await UserService.renewToken(token, user);
  
      if (result.success) {
        const eT2sLn = generateKey();
        const zA1v6X = encrypt(result.newToken,eT2sLn);
        const oHgP4f = encrypt(result.newTokenExpiration.toISOString(),eT2sLn);

        return res.status(200).json({
          eT2sLn,zA1v6X,oHgP4f
        });
      } else {
        return res.status(403).json({ message: result.message });
      }
    } catch (error) {
      console.error('Error al renovar el token:', error);
      return res.status(500).json({ message: 'Error en el servidor' });
    }
  }
}

export default new AuthController();
