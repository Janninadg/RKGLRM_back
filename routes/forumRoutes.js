// routes/ForumRoutes.js
import express from 'express';
import ForumController from '../controllers/forumController.js';
import RoleValidator from '../utils/RoleValidator.js';

const router = express.Router();

// Roles permitidos para crear posts
const allowedRolesForPost = [13, 14, 15];

// Obtener los últimos 5 posts
router.get('/latestPosts', ForumController.getLatestPosts);

// Crear un nuevo post
router.post(
  '/createPost',
  RoleValidator.checkRolesMiddleware(allowedRolesForPost),
  ForumController.createPost
);

// Obtener todas las categorías
router.get('/categories', ForumController.getAllCategories);

// Crear una respuesta a un post
router.post('/createReply', ForumController.createReply);

// Dar like/dislike a un post
router.post('/toggleLike', ForumController.toggleLike);

// Dar like/dislike a un reply
router.post('/toggleReplyLike', ForumController.toggleReplyLike);

// Obtener un post completo por id
router.get('/post/:post_id/:apodo?', ForumController.getPostById);

router.get('/latestPostsByCategory', ForumController.getLatestPostsByCategory);

router.post('/view/:postId', ForumController.increaseView);

export default router;
