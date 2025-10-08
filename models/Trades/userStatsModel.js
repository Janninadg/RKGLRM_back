import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const UserTradeStats = sequelize.define('user_trade_stats', {
  user: {
    type: DataTypes.STRING(11),
    primaryKey: true,
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  total_trades: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  completed_trades: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  cancelled_trades: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  avg_rating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  release_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  confirm_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
    onUpdate: DataTypes.NOW, // MySQL lo maneja con ON UPDATE
  },
}, {
  tableName: 'user_trade_stats',
  timestamps: false,
});

export default UserTradeStats;
