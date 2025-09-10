import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import eventRoutes from './eventRoutes.js';
import controlRoutes from './controlRouter.js';
import streamersRoutes from './streamersRoutes.js';
import storeRoutes from './storeRoutes.js';
import marketRoutes from './marketRoutes.js';
import webRoutes from './webRoutes.js';
import refineriaRoutes from './refineriaRoutes.js';
import forumRoutes from './forumRoutes.js';
import uploadRoutes from "./uploadRoutes.js";

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

// Montar rutas de tienda bajo api/market
router.use('/market', marketRoutes);

// Montar rutas de tienda bajo api/market
router.use('/refineria', refineriaRoutes);

// Montar rutas de foro bajo api/forum
router.use('/forum', forumRoutes);

// ...
router.use("/uploads", uploadRoutes);


export default router;
