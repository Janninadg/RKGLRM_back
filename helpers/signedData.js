import { KJUR, KEYUTIL } from 'jsrsasign';
import CryptoJS from 'crypto-js';

// Función para obtener la clave pública desde el servidor
export function obtenerClavePublicaDelServidor() {
    const publicKeyPEM = `
    -----BEGIN PUBLIC KEY-----
    MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAzPfu...
    ...MI2VMe8oVTjjHDxP99ANyW9tVv8zWK3t9uYKhC/WzCih
    2jCyBETV2Dg0y/Z9emw3Pz5EY
    -----END PUBLIC KEY-----
    `;
    // En este ejemplo, simplemente devolvemos la clave pública almacenada en la variable global
    return publicKeyPEM;
}

export function verifySignature(data, signature, publicKeyPEM) {
  try {
    // Cargar la clave pública desde la cadena PEM
    const publicKey = KEYUTIL.getKey(publicKeyPEM);

    const sig = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
    sig.init(publicKey);
    sig.updateString(data);

    // Verificar la firma
    return sig.verify(signature);
  } catch (error) {
    console.error('Error al verificar la firma:', error);
    return false;
  }
}

export function calculateDataHash(data) {
    const dataStr = JSON.stringify(data);
    const hash = CryptoJS.SHA256(dataStr);
    return hash.toString(CryptoJS.enc.Hex);
  }