import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const TradeRatings = sequelize.define('trade_ratings', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  chat_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  rater: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  target: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  role: {
    type: DataTypes.ENUM('BUYER', 'SELLER'),
    allowNull: false,
  },
  rating: {
    type: DataTypes.TINYINT,
    allowNull: false,
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'trade_ratings',
  timestamps: false, // No usar createdAt/updatedAt automáticos
});

export default TradeRatings;
