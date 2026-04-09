import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ClanLog = sequelize.define('clanlog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  rol: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'master',
  },
  target: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  action: {
    type: DataTypes.ENUM('ACCEPT', 'DECLINE', 'DELETE', 'CREATE'),
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'clanlog',
  timestamps: false,
});

export default ClanLog;