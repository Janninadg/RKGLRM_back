import express from 'express';
import WebController from '../controllers/webController.js';

const router = express.Router();

// Ruta para obtener el ranking
router.get('/home-summary', WebController.getHomeSummary);

router.get('/links', WebController.getLinks);

router.get('/anuncios', WebController.getAnuncios);

router.get('/assets', WebController.getBuyAssets);

router.get('/streamers', WebController.getStreamers);


router.get('/stages', WebController.getStages);

export default router;
