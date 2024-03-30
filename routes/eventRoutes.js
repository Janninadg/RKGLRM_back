import express from 'express';
import EventController from '../controllers/eventController.js';

const router = express.Router();

router.get('/all', EventController.obtenerTodos);

// Rutas de apis de evento Ruleta
router.get('/roulette/verfTcks/:id', EventController.verifyTickets);

router.post('/reedOne', EventController.redeemTicketAndReward);
router.post('/setPr', EventController.getAllRoulettePrizes);

router.post('/gtTGm', EventController.getTickets);

router.post('/byTcks', EventController.buyTickets);

router.post('/gtSlt', EventController.getSlots);

// Rutas de apis de evento Cupones

router.post('/reedCp', EventController.redeemCupon);

// Rutas evento Pumpkins
//router.post('/gameEvent', EventController.getTicketsEvents);
router.post('/reedMul', EventController.redeemAllPrizesEvent);

router.post('/dcTck', EventController.decreaseTickets);
router.post('/sesAct', EventController.verifyToken);

router.post('/stMtch', EventController.setPartida);

//CountDown:

router.post('/genMch', EventController.setAuthCountDown);


//Puzzle:
router.post('/gtPzzl', EventController.getPieceAndChest);
router.post('/gtnwP', EventController.obtenerNuevaPieza);
router.post('/gtCf', EventController.obtenerCofre);

export default router;