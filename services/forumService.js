// services/forumService.js
import { Op, fn, col, literal } from "sequelize";
import ForumPost from '../models/Forum/ForumPost.js';
import ForumCategory from '../models/Forum/ForumCategory.js';
import ForumReply from '../models/Forum/ForumReply.js';
import WebUser from '../models/webUsersModel.js';
import User from '../models/userModel.js';
import TokenSession from '../models/tokenSessionModel.js';
import sequelize from '../config/database.js';
import ForumPostLike from '../models/Forum/ForumPostLike.js';
import ForumReplyLike from '../models/Forum/ForumReplyLike.js';
import ForumUserRole from '../models/Forum/ForumRole.js';
import Role from '../models/Forum/Role.js';
import ForumPoints from '../models/Forum/ForumPoints.js';

class ForumService {
  async getLatestPosts(limit = 10) {
    try {
      // 1. Obtener posts
     const posts = await ForumPost.findAll({
        where:{ enable:1 },
        limit,
        order: [
          ['is_pinned', 'DESC'],   // Destacados primero
          ['created_at', 'DESC'],  // Luego por fecha de creación descendente
        ],
      });

      const result = [];

      for (const post of posts) {
        // 2. Categoria
        const category = await ForumCategory.findByPk(post.category_id);

        // 3. Buscar User por apodo (post.user_id)
        const user = await User.findOne({ where: { apodo: post.user_id } });
        const webuser = user
          ? await WebUser.findOne({ where: { user: user.id } })
          : null;

        // 4. Contar replies
        const repliesCount = await ForumReply.count({
          where: { post_id: post.id },
        });

        // 5. Último reply
        const lastReply = await ForumReply.findOne({
          where: { post_id: post.id },
          order: [['created_at', 'DESC']],
        });

        let lastPoster = null;
        if (lastReply) {
          // reply.user_id también es apodo
          const replyUser = await User.findOne({
            where: { apodo: lastReply.user_id },
          });
          const replyWebUser = replyUser
            ? await WebUser.findOne({ where: { user: replyUser.id } })
            : null;

          lastPoster = {
            name: replyUser?.apodo || 'Desconocido',
            url: '#',
            avatar:
              replyWebUser?.photo || 'https://i.pravatar.cc/100?img=11',
            color: await this.getUserColorByApodo(replyUser?.apodo), // <-- función reutilizable
          };
        }

        // 6. Badges
        const badges = [];
        if (post.is_pinned) {
          badges.push({
            name: 'pin',
            title: 'Anclado',
            icon: '<i class="fa fa-thumb-tack"></i>',
          });
        }

        // 7. Autor
        const author = {
          name: user?.apodo || 'Desconocido',
          url: '#',
          avatar: webuser?.photo || 'https://i.pravatar.cc/100?img=10',
          color: await this.getUserColorByApodo(user?.apodo), // <-- usamos la función
        };

        // 8. Fechas
        const createdAt = new Date(post.created_at);
        const updatedAt = new Date(post.updated_at);

        result.push({
          id: post.id,
          title: post.title,
          url: `/foro/post/${post.id}`,
          badges,
          author,
          forum: {
            name: category?.name || 'General',
            url: category.url,
            color: category.color,
          },
          date: createdAt.toISOString(),
          dateFormatted: createdAt.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
          }),
          replies: repliesCount,
          views: post.views || 0,
          lastPoster,
          lastDate: updatedAt.toISOString(),
          lastDateFormatted: updatedAt.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
          }),
        });
      }

      return result;
    } catch (error) {
      console.error('Error en ForumService.getLatestPosts:', error);
      throw new Error('Error al obtener los posts del foro');
    }
  }

   // Crear nuevo post
  async createPost(userId, token, title, content, destacado, category_id) {
    const t = await sequelize.transaction();

    try {
      // 1. Verificar token
      const sessionToken = await TokenSession.findOne({
        attributes: ['token'],
        where: {
          token: token,
          id: userId,
        },
        transaction: t,
      });

      if (!sessionToken) {
        await t.rollback();
        return {
          success: false,
          code: '100',
          message: 'Token inválido o sesión iniciada en otro navegador...',
        };
      }

      // 2. Buscar el usuario (por id)
      const user = await User.findByPk(userId, { transaction: t });
      if (!user) {
        await t.rollback();
        return { success: false, code: '101', message: 'Usuario no encontrado' };
      }

      // ⚠️ OJO: en forum_posts guardamos el apodo en user_id
      const newPost = await ForumPost.create(
        {
          title,
          content,
          category_id,
          user_id: user.apodo, // se guarda el apodo
          views: 0,
          is_pinned: Number(destacado),
          created_at: new Date(),
          updated_at: new Date(),
        },
        { transaction: t }
      );

      // 5. Actualizar forum_points con lock
      const pointsRecord = await ForumPoints.findOne({
        where: { user_id: user.apodo },
        transaction: t,
        lock: t.LOCK.UPDATE, // 🔒 Lock para concurrencia
      });

      if (pointsRecord) {
        pointsRecord.post_points += 10; // sumar 5 puntos por comentario
        await pointsRecord.save({ transaction: t });
      } else {
        await ForumPoints.create(
          {
            user_id: user.apodo,
            post_points: 10,
            reply_points: 0,
          },
          { transaction: t }
        );
      }

      await t.commit();

      return {
        success: true,
        code: '000',
        message: 'Post creado exitosamente',
        post: {
            id: newPost.id,
            url: `/foro/post/${newPost.id}`, // ✅ URL directa
        },
      };
    } catch (error) {
      await t.rollback();
      console.error('Error en ForumService.createPost:', error);
      return {
        success: false,
        code: '500',
        message: 'Error interno al crear el post',
      };
    }
  }

   // 🔹 Obtener todas las categorías
 async getAllCategories() {
   try {
    const categories = await ForumCategory.findAll({
      order: [["id", "ASC"]],
      raw: true,
    });

    const result = [];

    for (const category of categories) {
      const catId = category.id;

      // 📊 Totales por categoría
      const postsCount = await ForumPost.count({ where: { category_id: catId } });
      const totalViews = await ForumPost.sum("views", { where: { category_id: catId } });
      const totalLikes = await ForumPost.sum("likes", { where: { category_id: catId } });

      // 🔧 fix → usar IN
      const repliesCount = await ForumReply.count({
        where: {
          post_id: {
            [Op.in]: literal(`(SELECT id FROM forum_posts WHERE category_id = ${catId})`),
          },
        },
      });

      const uniqueWriters = await ForumPost.aggregate("user_id", "count", {
        distinct: true,
        where: { category_id: catId },
      });

      // 👑 Usuarios destacados
      const topPoster = await ForumPost.findOne({
        attributes: ["user_id", [fn("COUNT", col("id")), "count"]],
        where: { category_id: catId },
        group: ["user_id"],
        order: [[literal("count"), "DESC"]],
        raw: true,
      });

      const topReplier = await ForumReply.findOne({
        attributes: ["user_id", [fn("COUNT", col("id")), "count"]],
        where: {
          post_id: {
            [Op.in]: literal(`(SELECT id FROM forum_posts WHERE category_id = ${catId})`),
          },
        },
        group: ["user_id"],
        order: [[literal("count"), "DESC"]],
        raw: true,
      });

      const topLikedUser = await ForumPost.findOne({
        attributes: ["user_id", [fn("SUM", col("likes")), "likes"]],
        where: { category_id: catId },
        group: ["user_id"],
        order: [[literal("likes"), "DESC"]],
        raw: true,
      });

      const topViewedUser = await ForumPost.findOne({
        attributes: ["user_id", [fn("SUM", col("views")), "views"]],
        where: { category_id: catId },
        group: ["user_id"],
        order: [[literal("views"), "DESC"]],
        raw: true,
      });

      result.push({
        id: category.id,
        name: category.name,
        url: category.url,
        color: category.color,
        img: category.img,
        description: category.description,
       stats: [
          {
            stat: "Posts",
            number: postsCount || 0,
            icon: "fa fa-file-text"
          },
          {
            stat: "Replies",
            number: repliesCount || 0,
            icon: "fa fa-comments"
          },
          {
            stat: "Views",
            number: totalViews || 0,
            icon: "fa fa-eye"
          },
          {
            stat: "Likes",
            number: totalLikes || 0,
            icon: "fa fa-thumbs-up"
          },
          {
            stat: "Writers",
            number: uniqueWriters || 0,
            icon: "fa fa-user"
          }
        ],
       topUsers: {
          poster: topPoster && topPoster.count > 0
             ? {
                user: topPoster.user_id,
                type: "con más publicaciones",
                number: topPoster.count,
                icon: "fa fa-file-text",
                text:"posts"
              }
            : null,
          replier: topReplier && topReplier.count > 0
            ? {
                user: topReplier.user_id,
                type: "con más comentarios",
                number: topReplier.count,
                icon: "fa fa-comments",
                text:"replies"
              }
            : null,
          liked: topLikedUser && topLikedUser.likes > 0
            ? {
                user: topLikedUser.user_id,
                type: "cuyos posts recibieron más likes",
                number: topLikedUser.likes,
                icon: "fa fa-thumbs-up",
                text:"likes"
              }
            : null,
          viewed: topViewedUser && topViewedUser.views > 0
            ? {
                user: topViewedUser.user_id,
                type: "cuyos posts fueron más vistos",
                number: topViewedUser.views,
                icon: "fa fa-eye",
                text:"views"
              }
            : null,
        },
      });
    }

    return result;
  } catch (error) {
    console.error("Error en ForumService.getAllCategories:", error);
    return {
      success: false,
      code: "500",
      message: "Error al obtener las categorías",
    };
  }
  }

   // 🔹 Crear respuesta en un post
  async createReply({ user, token, post_id, content }) {
    const t = await sequelize.transaction();

    try {
      // 1. Validar sesión
      const sessionToken = await TokenSession.findOne({
        where: { token: token, id: user },
        transaction: t,
      });

      if (!sessionToken) {
        await t.rollback();
        return {
          success: false,
          code: '100',
          message: 'Token inválido o sesión iniciada en otro navegador...',
        };
      }

      // 2. Verificar existencia de post
      const post = await ForumPost.findByPk(post_id, { transaction: t });
      if (!post) {
        await t.rollback();
        return {
          success: false,
          code: '101',
          message: 'El post no existe',
        };
      }

      // 3. Obtener apodo del usuario
      const userData = await User.findByPk(user, { transaction: t });
      if (!userData) {
        await t.rollback();
        return {
          success: false,
          code: '102',
          message: 'Usuario no encontrado',
        };
      }

      // 4. Crear reply
      const newReply = await ForumReply.create(
        {
          post_id,
          user_id: userData.apodo, // ⚠️ Guardamos apodo aquí
          content,
          created_at: new Date(),
          updated_at: new Date(),
        },
        { transaction: t }
      );

      // 5. Actualizar forum_points con lock
      const pointsRecord = await ForumPoints.findOne({
        where: { user_id: userData.apodo },
        transaction: t,
        lock: t.LOCK.UPDATE, // 🔒 Lock para concurrencia
      });

      if (pointsRecord) {
        pointsRecord.reply_points += 5; // sumar 5 puntos por comentario
        await pointsRecord.save({ transaction: t });
      } else {
        await ForumPoints.create(
          {
            user_id: userData.apodo,
            post_points: 0,
            reply_points: 5,
          },
          { transaction: t }
        );
      }

      await t.commit();

      return {
        success: true,
        code: '000',
        message: 'Respuesta creada exitosamente',
        reply: {
          id: newReply.id,
          url: `/foro/post/${post_id}#reply-${newReply.id}`,
        },
      };
    } catch (error) {
      await t.rollback();
      console.error('Error en ForumService.createReply:', error);
      return {
        success: false,
        code: '500',
        message: 'Error interno al crear la respuesta',
      };
    }
  }

   async toggleLike({ user, token, post_id, flag }) {
    const t = await sequelize.transaction();

    try {
      // 1. Validar sesión
      const sessionToken = await TokenSession.findOne({
        where: { token, id: user },
        transaction: t,
        lock: t.LOCK.UPDATE, // 🔒 bloquea fila
      });
      if (!sessionToken) {
        await t.rollback();
        return { success: false, code: '100', message: 'Token inválido o sesión iniciada en otro navegador...' };
      }

      // 2. Validar post
      const post = await ForumPost.findByPk(post_id, {
        transaction: t,
        lock: t.LOCK.UPDATE, // 🔒 bloquea fila del post
      });
      if (!post) {
        await t.rollback();
        return { success: false, code: '101', message: 'El post no existe' };
      }

      // 3. Validar usuario
      const userData = await User.findByPk(user, { transaction: t, lock: t.LOCK.UPDATE });
      if (!userData) {
        await t.rollback();
        return { success: false, code: '102', message: 'Usuario no encontrado' };
      }
      const apodo = userData.apodo;

      // 4. Buscar like existente
      const existingLike = await ForumPostLike.findOne({
        where: { post_id, user_id: apodo },
        transaction: t,
        lock: t.LOCK.UPDATE, // 🔒 asegura consistencia
      });

      let action = '';
      if (flag === 1) {
        if (!existingLike) {
          await ForumPostLike.create(
            { post_id, user_id: apodo, created_at: new Date() },
            { transaction: t }
          );
          action = 'created';
        } else {
          await existingLike.destroy({ transaction: t });
          action = 'removed';
        }
      } else if (flag === 0) {
        if (existingLike) {
          await existingLike.destroy({ transaction: t });
          action = 'removed';
        } else {
          action = 'nothing_to_remove';
        }
      }

      // 5. Contar likes (solo del post actual, no de toda la categoría)
      const totalLikes = await ForumPostLike.count({
        where: { post_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // 6. Actualizar el post con el conteo
      await ForumPost.update(
        { likes: totalLikes },
        { where: { id: post_id }, transaction: t }
      );

      await t.commit();

      return {
        success: true,
        code: '000',
        message:
          action === 'created'
            ? 'Like agregado'
            : action === 'removed'
            ? 'Like eliminado'
            : 'Sin cambios',
        like: {
          post_id,
          user: apodo,
          liked: action === 'created',
        },
      };
    } catch (error) {
      await t.rollback();
      console.error('Error en ForumService.toggleLike:', error);
      return { success: false, code: '500', message: 'Error interno al gestionar el like' };
    }
  }

    async toggleReplyLike({ user, token, reply_id, flag }) {
    const t = await sequelize.transaction();

    try {
      // 1. Validar sesión
      const sessionToken = await TokenSession.findOne({
        where: { token, id: user },
        transaction: t,
      });

      if (!sessionToken) {
        await t.rollback();
        return {
          success: false,
          code: '100',
          message: 'Token inválido o sesión iniciada en otro navegador...',
        };
      }

      // 2. Validar usuario
      const userData = await User.findByPk(user, { transaction: t });
      if (!userData) {
        await t.rollback();
        return {
          success: false,
          code: '101',
          message: 'Usuario no encontrado',
        };
      }
      const apodo = userData.apodo;

      // 3. Validar reply
      const reply = await ForumReply.findByPk(reply_id, { transaction: t });
      if (!reply) {
        await t.rollback();
        return {
          success: false,
          code: '102',
          message: 'El comentario no existe',
        };
      }

      // 4. Buscar like existente
      const existingLike = await ForumReplyLike.findOne({
        where: { reply_id, user_id: apodo },
        transaction: t,
      });

      let action = '';
      if (flag === 1) {
        if (!existingLike) {
          await ForumReplyLike.create(
            { reply_id, user_id: apodo, created_at: new Date() },
            { transaction: t }
          );
          action = 'created';
        } else {
          action = 'already_liked';
        }
      } else if (flag === 0) {
        if (existingLike) {
          await existingLike.destroy({ transaction: t });
          action = 'removed';
        } else {
          action = 'nothing_to_remove';
        }
      }

      await t.commit();

      return {
        success: true,
        code: '000',
        message:
          action === 'created'
            ? 'Like agregado al comentario'
            : action === 'removed'
            ? 'Like eliminado del comentario'
            : 'Sin cambios',
        like: {
          reply_id,
          user: apodo,
          liked: action === 'created' ? true : false,
        },
      };
    } catch (error) {
      await t.rollback();
      console.error('Error en ForumService.toggleReplyLike:', error);
      return {
        success: false,
        code: '500',
        message: 'Error interno al gestionar like en comentario',
      };
    }
  }

  async getPostById(post_id,apodo) {
    try {
        // 1) Obtener el post sin includes
        const post = await ForumPost.findByPk(post_id);

        if (!post) {
        return {
            success: false,
            code: '404',
            message: 'Post no encontrado',
        };
        }

        // 2) Obtener la categoría a partir de category_id (si existe)
        let category = null;
        if (post.category_id) {
        const cat = await ForumCategory.findByPk(post.category_id, {
            attributes: ['id', 'name'],
        });
        if (cat) {
            category = { id: cat.id, name: cat.name };
        }
        }

        // 3) Obtener autor (apodo está en user_id)
        const user = await User.findOne({ where: { apodo: post.user_id } });
        const webUser = user ? await WebUser.findOne({ where: { user: user.id } }) : null;

        const author = {
          apodo: post.user_id,
          color: await this.getUserColorByApodo(user?.apodo), // <-- usamos la función
          photo: webUser ? webUser.photo : null,
          role: await this.getNameRoleByApodo(user?.apodo),
          stats: await this.getUserStatsByApodo(user?.apodo)
        };

        // 4) Contar likes del post
        const totalLikes = await ForumPostLike.count({ where: { post_id } });

        // 5) Obtener últimos 2 likes (ordenados por fecha) y mapear a apodos
        const recentLikeRecords = await ForumPostLike.findAll({
        where: { post_id },
        // limit: 2,
        order: [['created_at', 'DESC']],
        });

        const recentLikeUsers = [];
        for (const like of recentLikeRecords) {
        const u = await User.findOne({ where: { apodo: like.user_id } });
        if (u) recentLikeUsers.push(u.apodo);
        }

        // console.log(apodo)
        // console.log(recentLikeUsers)
        const flagLiked = apodo ? recentLikeUsers.includes(apodo) : false;

        // 6) Obtener replies + autor + likes
        const replies = await ForumReply.findAll({
          where: { post_id },
          order: [['created_at', 'ASC']],
        });

        const replyData = [];
        for (const reply of replies) {
          const replyUser = await User.findOne({ where: { apodo: reply.user_id } });
          const replyWebUser = replyUser
              ? await WebUser.findOne({ where: { user: replyUser.id } })
              : null;

          const replyLikes = await ForumReplyLike.count({
              where: { reply_id: reply.id },
          });

          replyData.push({
              id: reply.id,
              content: reply.content,
              created_at: reply.created_at,
              likes: replyLikes,
              author: {
                apodo: reply.user_id,
                color: await this.getUserColorByApodo(replyUser?.apodo), // <-- usamos la función
                photo: replyWebUser ? replyWebUser.photo : null,
                role: await this.getNameRoleByApodo(user?.apodo),
                stats: await this.getUserStatsByApodo(replyUser?.apodo)
              },
          });
        }

        // 7) Armar y devolver respuesta final
        return {
        success: true,
        code: '000',
        message: 'Post encontrado',
        post: {
            id: post.id,
            title: post.title,
            content: post.content,
            views: post.views,
            created_at: post.created_at,
            category,                 // ahora proviene de category_id
            author,
            likes: totalLikes,
            recentLikes: recentLikeUsers.slice(0, 2), // 👈 solo los 2 primeros,
            replies: replyData,
            flagLiked
        },
        };
    } catch (error) {
        console.error('Error en ForumService.getPostById:', error);
        return {
        success: false,
        code: '500',
        message: 'Error interno al obtener post',
        };
    }
    }

async incrementView(post_id) {
  const t = await sequelize.transaction();

  try {
    // 1. Validar post
    const post = await ForumPost.findByPk(post_id, {
      transaction: t,
      lock: t.LOCK.UPDATE, // Bloquea la fila para evitar race conditions
    });

    if (!post) {
      await t.rollback();
      return {
        success: false,
        code: '101',
        message: 'El post no existe',
      };
    }

    // 2. Incrementar views
    post.views = (post.views || 0) + 1;
    await post.save({ transaction: t });

    await t.commit();

    return {
      success: true,
      code: '000',
      views: post.views,
    };
  } catch (error) {
    await t.rollback();
    console.error('Error en ForumService.incrementView:', error);
    return {
      success: false,
      code: '500',
      message: 'Error interno al actualizar views',
    };
  }
}


   async getLatestPostsByCategory(categories=2,limit = 5) {
    try {
      // 1. Determinar categorías a consultar
      let categoriesToFetch;
      if (categories === 'all') {
        categoriesToFetch = await ForumCategory.findAll();
      } else if (Array.isArray(categories)) {
        categoriesToFetch = await ForumCategory.findAll({
          where: { id: categories },
        });
      } else if (typeof categories === 'number') {
        const category = await ForumCategory.findOne({ where: { id: categories } });
        categoriesToFetch = category ? [category] : [];
      } else {
        categoriesToFetch = [];
      }

      const results = [];

      for (const category of categoriesToFetch) {
        // 2. Traer últimos X posts de la categoría
        const posts = await ForumPost.findAll({
          where: { category_id: category.id, enable: 1 },
          limit,
          order: [
            ['is_pinned', 'DESC'],
            ['created_at', 'DESC'],
          ],
        });

        const formattedPosts = [];
        for (const post of posts) {
          // 3. Autor (User + WebUser)
          const user = await User.findOne({ where: { apodo: post.user_id } });
          const webuser = user
            ? await WebUser.findOne({ where: { user: user.id } })
            : null;

          // 4. Contar replies
          const repliesCount = await ForumReply.count({
            where: { post_id: post.id },
          });

          // 5. Último reply
          const lastReply = await ForumReply.findOne({
            where: { post_id: post.id },
            order: [['created_at', 'DESC']],
          });

          let lastPoster = null;
          if (lastReply) {
            const replyUser = await User.findOne({
              where: { apodo: lastReply.user_id },
            });
            const replyWebUser = replyUser
              ? await WebUser.findOne({ where: { user: replyUser.id } })
              : null;

            lastPoster = {
              name: replyUser?.apodo || 'Desconocido',
              url: '#',
              avatar: replyWebUser?.photo || 'https://i.pravatar.cc/100?img=11',
              color: await this.getUserColorByApodo(replyUser?.apodo),
            };
          }

          // 6. Badges
          const badges = [];
          if (post.is_pinned) {
            badges.push({
              name: 'pin',
              title: 'Anclado',
              icon: '<i class="fa fa-thumb-tack"></i>',
            });
          }

          // 7. Autor
          const author = {
            name: user?.apodo || 'Desconocido',
            url: '#',
            avatar: webuser?.photo || 'https://i.pravatar.cc/100?img=10',
            color: await this.getUserColorByApodo(user?.apodo),
          };

          // 8. Fechas
          const createdAt = new Date(post.created_at);
          const updatedAt = new Date(post.updated_at);

          formattedPosts.push({
            id: post.id,
            title: post.title,
            url: `/foro/post/${post.id}`,
            badges,
            author,
            forum: {
              name: category?.name || 'General',
              url: category.url,
              color: category.color,
            },
            date: createdAt.toISOString(),
            dateFormatted: createdAt.toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
            }),
            replies: repliesCount,
            views: post.views || 0,
            lastPoster,
            lastDate: updatedAt.toISOString(),
            lastDateFormatted: updatedAt.toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
            }),
          });
        }

        results.push({
          category: {
            id: category.id,
            name: category.name,
            url: category.url,
            color: category.color,
          },
          posts: formattedPosts,
        });
      }

      return results;
    } catch (error) {
      console.error('Error en ForumService.getLatestPostsByCategory:', error);
      return {
        success: false,
        code: '500',
        message: 'Error obteniendo posts por categoría',
      };
    }
  }

  /**
   * Obtiene el color del usuario según su rol principal
   * @param {string} apodo - El apodo del usuario
   * @returns {Promise<string>} - Color en hex, por defecto #FFFFFF
   */
  async getUserColorByApodo(apodo) {
    try {
      // 1. Buscar rol principal en forum_roles
      const principalRole = await ForumUserRole.findOne({
        where: { user_id: apodo, principal: 1 },
        attributes: ['role_id'],
        raw: true,
      });

      if (!principalRole) return '#FFFFFF'; // sin rol principal -> blanco

      // 2. Obtener el color del rol desde roles
      const roleInfo = await Role.findOne({
        where: { id: principalRole.role_id },
        attributes: ['color'],
        raw: true,
      });

      return roleInfo?.color || '#FFFFFF';
    } catch (err) {
      console.error('Error al obtener color de usuario:', err);
      return '#FFFFFF';
    }
  }

  async getUserStatsByApodo(apodo) {
  try {
    // 1) Buscar el usuario por apodo
    const user = await User.findOne({ where: { apodo } });
    if (!user) return [];

    // 2) Cantidad de likes que ha dado en posts
    const likesOnPosts = await ForumPostLike.count({
      where: { user_id: apodo }, // user_id en likes es apodo
    });

    // 3) Cantidad de likes que ha dado en replies
    const likesOnReplies = await ForumReplyLike.count({
      where: { user_id: apodo },
    });

    // 4) Cantidad de comentarios (replies) hechos
    const comments = await ForumReply.count({
      where: { user_id: apodo },
    });

    // 5) Cantidad de posts creados
    const posts = await ForumPost.count({
      where: { user_id: apodo },
    });

    // 6) Suma de todas las views recibidas en sus posts
    const viewsResult = await ForumPost.findAll({
      where: { user_id: apodo },
      attributes: ['views'],
    });
    const views = viewsResult.reduce((acc, p) => acc + (p.views || 0), 0);

    // 7) Retornar array dinámico con iconos y títulos
    return [
      {
        name: 'posts',
        title: 'Posts',
        counter: posts,
        icon: 'fa fa-comments',
      },
      {
        name: 'comments',
        title: 'Comentarios',
        counter: comments,
        icon: 'fa fa-comment',
      },
      {
        name: 'likes',
        title: 'Likes',
        counter: likesOnPosts + likesOnReplies,
        icon: 'fa fa-heart',
      },
      {
        name: 'views',
        title: 'Visitas',
        counter: views,
        icon: 'fa fa-eye',
      },
    ];
  } catch (error) {
    console.error('Error en getUserStatsByApodo:', error);
    return [];
  }
}


  async getNameRoleByApodo(apodo, transaction = null) {
  if (!apodo) return null;

  try {
    // 1. Buscar roles del usuario en forum_roles, priorizando principal
    const forumRole = await ForumUserRole.findOne({
      where: { user_id: apodo },
      order: [['principal', 'DESC'], ['role_id', 'ASC']],
      transaction,
    });

    if (!forumRole) return null;

    // 2. Obtener el nombre del rol desde la tabla roles
    const role = await Role.findByPk(forumRole.role_id, { transaction });
    return role?.name || null;
  } catch (err) {
    console.error('Error en getNameRoleByApodo:', err);
    return null;
  }
}

}

export default new ForumService();
