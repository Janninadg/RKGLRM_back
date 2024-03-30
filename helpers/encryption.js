import CryptoJS from 'crypto-js';

// Función para generar una clave aleatoria
export const generateKey = () => {
  const key = CryptoJS.lib.WordArray.random(32); // 256 bits
  return key.toString();
};

// Función para encriptar datos
export const encrypt = (text, key) => {
  const iv = CryptoJS.lib.WordArray.random(16); // 128 bits
  const ciphertext = CryptoJS.AES.encrypt(text, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return iv.toString() + ':' + ciphertext.toString();
};

// Función para desencriptar datos
export const decrypt = (text, key) => {
  const parts = text.split(':');
  const iv = CryptoJS.enc.Hex.parse(parts.shift());
  const encryptedText = parts.join(':');

  const decrypted = CryptoJS.AES.decrypt(encryptedText, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
};
