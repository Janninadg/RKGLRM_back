import express from 'express';
import MarketController from '../controllers/MarketController.js';

const router = express.Router();

// Rutas de apis de tienda
router.post('/buyItem', MarketController.buyItems);
router.post('/rtrnItem', MarketController.returnItem);
router.post('/sellItems', MarketController.sellItem);

router.post('/hstyPuch', MarketController.getHistoryPucharse);
router.post('/hstySells', MarketController.getHistorySells);

router.get('/getItems', MarketController.getItems);

router.get('/getParams', MarketController.getParams);

router.post('/initChat', MarketController.initChatTrade);

export default router;