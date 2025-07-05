import express from 'express';
import WebController from '../controllers/webController.js';

const router = express.Router();

// Ruta para obtener el ranking
router.get('/links', WebController.getLinks);
router.get('/assets', WebController.getBuyAssets);


export default router;