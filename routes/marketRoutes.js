import express from 'express';
import MarketController from '../controllers/MarketController.js';

const router = express.Router();

// Rutas de apis de tienda
router.post('/getPoints', MarketController.getEventPoints);
router.post('/buyItem', MarketController.buyItems);

router.post('/hstyPuch', MarketController.getHistoryPucharse);

router.get('/getItems', MarketController.getItems);

export default router;