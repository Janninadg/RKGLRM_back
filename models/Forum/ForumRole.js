// models/Forum/ForumUserRole.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js'; // Ajusta la ruta según tu estructura

const ForumUserRole = sequelize.define('ForumUserRole', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.STRING(50),
    allowNull: false, // apodo del usuario
    collate: 'utf8mb4_general_ci',
  },
  role_id: {
    type: DataTypes.INTEGER(11),
    allowNull: false, // referencia a forum_roles.id
  },
  principal: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: 0, // 0 = false, 1 = true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'forum_roles', // nombre real de la tabla
  timestamps: false, // ya tienes created_at manual
});

export default ForumUserRole;
