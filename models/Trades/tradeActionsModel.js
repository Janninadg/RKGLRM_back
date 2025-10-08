import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js'; // Ajusta la ruta si es necesario

const TradeActions = sequelize.define('trade_actions', {
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
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  action: {
    type: DataTypes.ENUM(
      'CREATE_TRADE',
      'CONFIRM_PAYMENT',
      'RELEASE_ITEM',
      'CANCEL_TRADE',
      'SYSTEM_HOLD',
      'SYSTEM_RELEASE'
    ),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  details: {
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
  tableName: 'trade_actions',
  timestamps: false, // no usa createdAt/updatedAt automáticos
});

export default TradeActions;
