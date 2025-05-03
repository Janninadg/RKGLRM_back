import express from 'express';
import StoreController from '../controllers/storeController.js';

const router = express.Router();

// Rutas de apis de tienda
router.post('/getPoints', StoreController.getEventPoints);
router.post('/buyItem', StoreController.buyItems);

router.post('/hstyPuch', StoreController.getHistoryPucharse);

router.get('/getItems', StoreController.getItems);

router.post('/getVirtualInv', StoreController.getVirtualInventory);

export default router;