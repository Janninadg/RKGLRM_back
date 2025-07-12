import express from 'express';
import UserController from '../controllers/userController.js';

const router = express.Router();

// Ruta para listar usuarios
//router.get('/all', UserController.getAllUsers);

// Ruta para obtener datos de usuario por ID
//router.get('/user/:id', UserController.getUserById);

// Ruta para obtener el gold de un usuario por ID
//router.get('/gold/:id/', UserController.getUserGold);

// Ruta para obtener el cash de un usuario por su ID
//router.get('/cash/:id', UserController.getCashByUserId);

// Obtener ID por nombre
//router.get('/uid/:name', UserController.getUserIdByUsername);


router.post('/gtAss', UserController.getAssetsUser);
router.post('/sesAct', UserController.verifyToken);

// Registrar usuario
router.post('/reg', UserController.registerUser);

// Ruta para obtener el perfil de un usuario por su nombre de usuario
router.get('/prf/:name/:token', UserController.getProfile);

// Ruta para obtener el ranking
router.get('/rnk', UserController.getRanking);

// Ruta para obtener tipo de cambio
router.get('/exch', UserController.getExchangeRate);

// Ruta para obtener tipo de cambio
router.post('/exch/ok', UserController.exchangeCash);

//Stages:
router.post('/stStgs', UserController.getTickets);

//Shopping
router.post('/shopAst', UserController.buyAssets);

export default router;
