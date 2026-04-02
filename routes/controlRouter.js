import express from 'express';
import GMPanelController from '../controllers/gmPanelController.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const tempUploadPath = 'C:/xampp/htdocs/files/.tmp-filesbck';

// Crear el directorio si no existe
if (!fs.existsSync(tempUploadPath)) {
  fs.mkdirSync(tempUploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // o puedes renombrar con timestamp, etc.
  }
});

const upload = multer({ storage }); // ✅ Ahora usa diskStorage

const router = express.Router();

//Usuarios
router.post('/set', GMPanelController.verifyIs);

router.post('/users', GMPanelController.getUserstoBan);
router.post('/getNames', GMPanelController.getUsersName);

router.post('/gfPowUs', GMPanelController.giftPowerUser);

router.post('/actionList', GMPanelController.banUsers);

router.post('/loadExch', GMPanelController.recargaCash);

router.post('/getChrcUsr', GMPanelController.getPersonajeUser);
router.post('/setChrUsr', GMPanelController.setLevelChUser);
router.post('/users-multi', GMPanelController.getUsersToBanMulti);
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
router.post('/upFiles', upload.array('fs'), GMPanelController.uploadFiles);

// router.post('/setLinkStm', GMPanelController.changeLinkStreamer);
router.post('/cancelChat', GMPanelController.cancelChat);
router.post('/getAllChats', GMPanelController.getAllChats);

export default router;