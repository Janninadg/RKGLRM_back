import express from 'express';
import clanController from './clan.controller.js';

const router = express.Router();

router.post('/all', clanController.getAllClans);
router.post('/my', clanController.getMyClan);
router.post('/members', clanController.getClanMembers);
router.post('/requests', clanController.getClanRequests);
router.post('/request/send', clanController.sendClanRequest);
router.post('/request/cancel', clanController.cancelClanRequest);
router.post('/create', clanController.createClan);
router.post('/request/resolve', clanController.resolveClanRequest);
router.post('/member/delete', clanController.deleteClanMember);
router.post('/leave', clanController.leaveClan);

export default router;
