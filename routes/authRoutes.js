import express from 'express';
import AuthController from '../controllers/authController.js';

const router = express.Router();

// Ruta para iniciar sesión
router.post('/in', AuthController.login);

// Ruta para el endpoint de logout
router.post('/out', AuthController.logout);

// Ruta para el endpoint de renew Token
router.post('/rnw', AuthController.renewToken);

// Ruta para verificar que el token sea valido
//router.post('/validation', AuthController.validateUniqueSession);

export default router;
