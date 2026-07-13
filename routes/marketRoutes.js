import express from 'express';
import MarketController from '../controllers/marketController.js';

const router = express.Router();

// Rutas de apis de tienda
router.post('/buyItem', MarketController.buyItems);
router.post('/rtrnItem', MarketController.returnItem);
router.post('/sellItems', MarketController.sellItem);

router.post('/hstyPuch', MarketController.getHistoryPucharse);
router.post('/hstySells', MarketController.getHistorySells);

router.get('/getItems', MarketController.getItems);
router.get('/getPymentMethods', MarketController.getPayments);

router.get('/getParams', MarketController.getParams);

router.post('/getChat', MarketController.getChat);

router.post('/initChat', MarketController.initChatTrade);

router.post('/submitRating', MarketController.submitTradeRating);

router.post('/sendMessage', MarketController.sendMessage); //send message to chat
router.post('/history', MarketController.getHistory); //get history of chat

router.post('/getUserChats', MarketController.getUserChats); //get history of chat
router.post('/contactStatus', MarketController.getMarketplaceContactStatus);
router.post('/updateWhatsapp', MarketController.updateMarketplaceWhatsapp);

export default router;
