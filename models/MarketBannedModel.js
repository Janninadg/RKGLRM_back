import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MarketBanned = sequelize.define('market_banned', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  user: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  ban_status: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0, // 0=ok,1=no vender,2=no comprar,3=no ambos
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'market_banned',
  timestamps: false
});

export default MarketBanned;