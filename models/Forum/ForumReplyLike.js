// models/ForumReplyLike.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const ForumReplyLike = sequelize.define('ForumReplyLike', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  reply_id: {
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
  tableName: 'forum_reply_likes',
  timestamps: false, // manejamos created_at manual
  indexes: [
    {
      unique: true,
      fields: ['reply_id', 'user_id'], // un usuario solo puede dar un like por reply
    }
  ]
});

export default ForumReplyLike;
