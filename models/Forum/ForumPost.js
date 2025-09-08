// models/ForumPost.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const ForumPost = sequelize.define('ForumPost', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  category_id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  user_id: {
    type: DataTypes.STRING(12),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  likes: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
    defaultValue: 0,
  },
  views: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
    defaultValue: 0,
  },
  is_pinned: {
    type: DataTypes.TINYINT(1),
    allowNull: true,
    defaultValue: 0,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  enable: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'forum_posts',
  timestamps: false,
});

export default ForumPost;
