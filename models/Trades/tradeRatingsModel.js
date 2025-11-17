import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const TradeRatings = sequelize.define('trade_ratings', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },

  // Usuario que califica
  rater: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  rater_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },

  // Usuario que recibe la calificación
  target: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  target_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },

  // BUYER o SELLER
  role: {
    type: DataTypes.ENUM('BUYER', 'SELLER'),
    allowNull: false,
  },

  // Rating 1–5
  rating: {
    type: DataTypes.TINYINT,
    allowNull: false,
  },

  // Comentario opcional (VARCHAR 500)
  comment: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },

  // Fecha del review
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
