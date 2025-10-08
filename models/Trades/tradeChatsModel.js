import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js'; // Ajusta la ruta si es necesario

const TradeChats = sequelize.define('trade_chats', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  trade_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  buyer: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  seller: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  payment_method_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'CANCELLED'),
    allowNull: true,
    defaultValue: 'ACTIVE',
    collate: 'utf8mb4_general_ci',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'trade_chats',
  timestamps: false, // no uses createdAt/updatedAt automáticos
});

export default TradeChats;
