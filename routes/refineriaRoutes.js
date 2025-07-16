import express from 'express';
import RefineriaController from '../controllers/refineriaController.js';

const router = express.Router();

// Rutas de apis de inventario
router.post('/gtInv', RefineriaController.getInventory);
router.post('/gtHisR', RefineriaController.getHistory);

router.post('/refIt', RefineriaController.refinyItem);


export default router;