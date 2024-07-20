import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import eventRoutes from './eventRoutes.js';
import controlRoutes from './controlRouter.js';
import streamersRoutes from './streamersRoutes.js';
import storeRoutes from './storeRoutes.js';
import webRoutes from './webRoutes.js';

const router = express.Router();

//a console.log(req.clientIp);

// Montar rutas de autenticación bajo api/auth
router.use('/auth', authRoutes);

// Montar rutas de usuarios bajo api/users
router.use('/users', userRoutes);

// Montar rutas de eventos bajo api/events
router.use('/events', eventRoutes);

// Montar rutas de eventos bajo api/contol
router.use('/control', controlRoutes);

// Montar rutas de eventos bajo api/streamers
router.use('/streamers', streamersRoutes);

// Montar rutas de eventos bajo api/web
router.use('/web', webRoutes);

// Montar rutas de tienda bajo api/store
router.use('/store', storeRoutes);

export default router;
