import express from 'express';
import StreamersController from '../controllers/streamersController.js';

const router = express.Router();

router.post('/setup', StreamersController.verifyIs);
router.post('/genCpn', StreamersController.setCupon);

export default router;