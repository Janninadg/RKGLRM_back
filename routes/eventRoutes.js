import express from 'express';
import EventController from '../controllers/eventController.js';

const router = express.Router();

// Rutas de apis de evento Cupones

router.post('/reedCp', EventController.redeemCupon);

export default router;