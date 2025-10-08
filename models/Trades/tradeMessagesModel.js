// models/trade_messages.js
import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const TradeMessage = sequelize.define('trade_messages', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  chat_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  sender: {
    type: DataTypes.STRING(11),
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  message_type: {
    type: DataTypes.ENUM('USER', 'SYSTEM'),
    allowNull: true,
    defaultValue: 'USER',
    collate: 'utf8mb4_general_ci',
  },
  content_type: {
    type: DataTypes.ENUM('TEXT', 'IMAGE'),
    allowNull: false,
    defaultValue: 'TEXT',
    collate: 'utf8mb4_general_ci',
  },
  file_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  // Nuevo campo: a quién se muestra el mensaje del sistema
  visible_to: {
    type: DataTypes.ENUM('BOTH', 'BUYER', 'SELLER'),
    allowNull: false,
    defaultValue: 'BOTH',
    collate: 'utf8mb4_general_ci',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'trade_messages',
  timestamps: false,
});

export default TradeMessage;
