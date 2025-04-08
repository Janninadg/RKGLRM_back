import express from 'express';
import GMPanelController from '../controllers/gmPanelController.js';

const router = express.Router();

//Usuarios
router.post('/set', GMPanelController.verifyIs);

router.post('/users', GMPanelController.getUserstoBan);
router.post('/getNames', GMPanelController.getUsersName);

router.post('/gfPowUs', GMPanelController.giftPowerUser);

router.post('/actionList', GMPanelController.banUsers);

router.post('/loadExch', GMPanelController.recargaCash);

//Eventos
router.post('/genCpn', GMPanelController.setCupon);

//Clanes
router.post('/createCln', GMPanelController.createClan);
router.post('/getClanes', GMPanelController.getClanes);
router.post('/addMembers', GMPanelController.addMembers);

// Rutas login/out:
router.post('/in', GMPanelController.login);
router.post('/out', GMPanelController.logout);

//Configuraciones
router.post('/getChrc', GMPanelController.getPersonajes);
router.post('/setLevel', GMPanelController.setLevel);
router.post('/getLogs', GMPanelController.getLogs);

//Streamers
router.post('/getStrms', GMPanelController.getStreamers);
router.post('/setStatusSt', GMPanelController.changeStreamerStatus);
router.post('/setLinkStm', GMPanelController.changeLinkStreamer);

//Anuncios
router.post('/getAnuncios', GMPanelController.getAnuncios);
router.post('/setStatusAn', GMPanelController.changeAnunciosStatus);
router.post('/createAn', GMPanelController.crearAnuncio);

//Servidor
router.post('/enviarMssg', GMPanelController.enviarMensajes);

// router.post('/setLinkStm', GMPanelController.changeLinkStreamer);

export default router;