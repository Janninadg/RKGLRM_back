// controllers/forumController.js
import ForumService from '../services/forumService.js';

class ForumController {
  async getLatestPosts(req, res) {
    try {
      const posts = await ForumService.getLatestPosts(10);
      res.status(200).json(posts);
    } catch (error) {
      console.error('Error en ForumController.getLatestPosts:', error.message);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

   async createPost(req, res, next) {
    try {
      const { user, token, title, content,destacado, category_id } = req.body;

      const response = await ForumService.createPost(
        user,
        token,
        title,
        content,
        destacado,
        category_id
      );

      if (response.success) {
        return res.status(200).json(response);
      } else {
        return res.status(400).json(response);
      }
    } catch (error) {
      console.error('Error en ForumController.createPost:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async getAllCategories(req, res) {
    try {
      const data = await ForumService.getAllCategories();
        res.status(200).json(data);
    } catch (error) {
      console.error('Error en ForumController.getAllCategories:', error);
      return res.status(500).json({
        success: false,
        code: '500',
        message: 'Error interno del servidor',
      });
    }
  }

  async increaseView(req, res) {
    const postId = parseInt(req.params.postId, 10);

    if (!postId) {
      return res.status(400).json({ success: false, message: 'Post ID inválido' });
    }

    try {
      const updatedViews = await ForumService.incrementView(postId);
      return res.json({ success: true, views: updatedViews });
    } catch (error) {
      console.error('Error en increaseView:', error);
      return res.status(500).json({ success: false, message: 'Error al actualizar vistas' });
    }
  }

  async createReply(req, res) {
    try {
      const { user, token, post_id, content } = req.body;

      const result = await ForumService.createReply({
        user,
        token,
        post_id,
        content,
      });

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error en ForumController.createReply:', error);
      return res.status(500).json({
        success: false,
        code: '500',
        message: 'Error interno del servidor',
      });
    }
  }

  async editPost(req, res) {
    try {
      const { user, token, post_id, title, content, category_id, is_pinned } = req.body;

      const result = await ForumService.editPost({
        user,
        token,
        post_id,
        title,
        content,
        category_id,
        is_pinned,
      });

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error("Error en ForumController.editPost:", error);
      return res.status(500).json({
        success: false,
        code: '500',
        message: 'Error interno del servidor',
      });
    }
  }

  async toggleStatus(req, res) {
    try {
      const { user, token, post_id } = req.body;

      const result = await ForumService.toggleStatus({
        user,
        token,
        post_id,
      });

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error en ForumController.toggleStatus:', error);
      return res.status(500).json({
        success: false,
        code: '500',
        message: 'Error interno del servidor',
      });
    }
  }

  async getPostsByUser(req, res) {
    try {
      const { user, token } = req.body;

      const result = await ForumService.getPostsByUser({
        user,
        token
      });

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error en ForumController.getPostsByUser:', error);
      return res.status(500).json({
        success: false,
        code: '500',
        message: 'Error interno del servidor',
      });
    }
  }

    async toggleLike(req, res) {
    try {
      const { user, token, post_id, flag } = req.body;

      // console.log(user);
      const result = await ForumService.toggleLike({
        user,
        token,
        post_id,
        flag,
      });

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error en ForumController.toggleLike:', error);
      return res.status(500).json({
        success: false,
        code: '500',
        message: 'Error interno del servidor',
      });
    }
  }

  async toggleReplyLike(req, res) {
    try {
      const { user, token, reply_id, flag } = req.body;

      const result = await ForumService.toggleReplyLike({
        user,
        token,
        reply_id,
        flag,
      });

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Error en ForumController.toggleReplyLike:', error);
      return res.status(500).json({
        success: false,
        code: '500',
        message: 'Error interno del servidor',
      });
    }
  }

    async getPostById(req, res) {
        try {
            const { post_id, apodo } = req.params;

            const result = await ForumService.getPostById(post_id, apodo);

            if (result.success) {
            return res.status(200).json(result);
            } else {
            return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error en ForumController.getPostById:', error);
            return res.status(500).json({
            success: false,
            code: '500',
            message: 'Error interno del servidor',
            });
        }
    }

    async getLatestPostsByCategory(req, res) {
        try {
            // const { limit } = req.query; // opcional, por defecto 5
            const result = await ForumService.getLatestPostsByCategory(2,5);
            res.status(200).json(result);
        } catch (error) {
            console.error('Error en ForumController.getLatestPostsByCategory:', error);
            return res.status(500).json({
            success: false,
            code: '500',
            message: 'Error interno del servidor',
            });
        }
    }

}

export default new ForumController();
