// utils/RoleValidator.js

import ForumUserRole from "../models/Forum/ForumRole.js";
import User from "../models/userModel.js";

export default class RoleValidator {

  /**
   * Verifica si un usuario (por apodo) tiene al menos uno de los roles permitidos
   * @param {number} userId - ID del usuario en tabla User
   * @param {Array<number>} allowedRoles - array de IDs de roles permitidos
   * @param {Transaction} [transaction] - opcional
   * @returns {Promise<boolean>}
   */
  static async hasAnyRole(userId, allowedRoles, transaction = null) {
    if (!userId || !allowedRoles?.length) return false;

    // 1. Obtener apodo
    const user = await User.findByPk(userId, { transaction });
    if (!user) return false;
    const apodo = user.apodo;

    //  2. Buscar roles directamente en forum_roles
    const forumRoles = await ForumUserRole.findAll({
      where: { user_id: apodo },
      transaction,
    });

    if (!forumRoles?.length) return false;

    // 3. Verificar si alguno de los role_id coincide con los permitidos
    return forumRoles.some(fr => allowedRoles.includes(fr.role_id));
  }

  /**
   * Middleware Express para validar roles antes de continuar
   * @param {Array<number>} allowedRoles - roles permitidos
   */
  static checkRolesMiddleware(allowedRoles) {
    return async (req, res, next) => {
      try {
        const userId = req.body._u || req.body.user;
        const hasRole = await RoleValidator.hasAnyRole(userId, allowedRoles);
        if (!hasRole) {
          return res.json({
            success: false,
            code: '403',
            message: '⚠️ No tienes permisos para realizar esta acción',
          });
        }
        next();
      } catch (err) {
        console.error('Error en RoleValidator middleware:', err);
        return res.json({
          success: false,
          code: '500',
          message: 'Error interno en la verificación de permisos',
        });
      }
    };
  }
}
