// models/ForumPostLike.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const ForumPostLike = sequelize.define('ForumPostLike', {
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
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'forum_post_likes',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['post_id', 'user_id'], // un usuario solo puede dar like una vez a un post
    }
  ]
});

export default ForumPostLike;
