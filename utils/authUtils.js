import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import config from '../config/config.js';

const signToken = async (user,sessionActive) => {
  const getRandomIndex = () => Math.floor(Math.random() * config.jwtSecret.length);
  const randomIndex = getRandomIndex();
  const selectedKey = config.jwtSecret[randomIndex];

  const sign = promisify(jwt.sign);
  // console.log("USER TOKEN:",user);

  const payload = { id: user };

  if (sessionActive === 'false') {
    const expiresInMinutes = 720; // El tiempo de expiración en minutos
    const localExpirationTime = new Date();
    localExpirationTime.setMinutes(localExpirationTime.getMinutes() + expiresInMinutes);
    payload.exp = Math.floor(localExpirationTime / 1000);
  }

  const token = await sign(payload, selectedKey);
  return token;
};

const verifyToken = async (token) => {
  // console.log("TOKEN VERIFY TOKEN:",token);
  const verify = promisify(jwt.verify);
  // console.log("TOKEN VERIFY FUNCTION:",verify);
 
  for (const secretKey of config.jwtSecret) {
    try {
      const decoded = await verify(token, secretKey);
      return decoded;
    } catch (error) {
      // Si hay un error, se continúa con la siguiente clave
      //console.error(`Error al verificar el token con la clave: ${secretKey}`);
    }
  }

  // Si ninguna clave es válida, lanzar un error
  throw new Error('Token inválido');
};

const expiredDate = (token) => {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.alg) {
      throw new Error('Token inválido');
    }

    const expirationTime = decoded.payload.exp;
    if (!expirationTime) {
      return null;
    }

    const expirationDate = new Date(expirationTime * 1000);
    return expirationDate;
  } catch (error) {
    throw new Error('Token inválido');
  }
};

const generateRandomToken = () =>{
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const tokenLength = 100;
  let token = '';

  for (let i = 0; i < tokenLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    token += characters.charAt(randomIndex);
  }

  return token;
}

export { signToken, verifyToken, expiredDate,generateRandomToken };
