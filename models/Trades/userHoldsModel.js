import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js';

const UserInternalHolds = sequelize.define('user_internal_holds', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  trade_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  chat_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  method_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('HELD', 'RELEASED', 'CANCELLED'),
    allowNull: true,
    defaultValue: 'HELD',
    collate: 'utf8mb4_general_ci',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  released_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },
}, {
  tableName: 'user_internal_holds',
  timestamps: false,
});

export default UserInternalHolds;
