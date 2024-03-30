import express from 'express';
import WebController from '../controllers/webController.js';

const router = express.Router();

// Ruta para obtener el ranking
router.get('/links', WebController.getLinks);

router.get('/anuncios', WebController.getAnuncios);

export default router;