// models/ForumCategory.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const ForumCategory = sequelize.define('ForumCategory', {
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
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'forum_categories',
  timestamps: false,
});

export default ForumCategory;
