// models/Role.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  type: {
    type: DataTypes.ENUM('game', 'forum', 'event', 'admin', 'other'),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  min_level: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  max_level: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  is_unique: {
    type: DataTypes.TINYINT(1),
    allowNull: true,
    defaultValue: 1, // por defecto es único
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'roles',
  timestamps: false,
});

export default Role;
