import express from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import marketRoutes from './marketRoutes.js';
import webRoutes from './webRoutes.js';
import refineriaRoutes from './refineriaRoutes.js';

const router = express.Router();

//a console.log(req.clientIp);

// Montar rutas de autenticación bajo api/auth
router.use('/auth', authRoutes);

// Montar rutas de usuarios bajo api/users
router.use('/users', userRoutes);

// Montar rutas de eventos bajo api/web
router.use('/web', webRoutes);

// Montar rutas de tienda bajo api/market
router.use('/market', marketRoutes);

// Montar rutas de tienda bajo api/market
router.use('/refineria', refineriaRoutes);

export default router;
