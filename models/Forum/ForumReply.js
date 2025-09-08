// models/ForumReply.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const ForumReply = sequelize.define('ForumReply', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  post_id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  user_id: {
    type: DataTypes.STRING(12),
    allowNull: false,
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
}, {
  tableName: 'forum_replies',
  timestamps: false,
});

export default ForumReply;
