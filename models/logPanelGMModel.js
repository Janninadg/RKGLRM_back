import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LogPanelGM = sequelize.define('logpanelgm', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
  },
  userAction: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  user: {
    type: DataTypes.TEXT,
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  amount: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  }, 
  cupon: {
    type: DataTypes.STRING(20),
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  type: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'logpanelgm',
  timestamps: false,
});

export default LogPanelGM;
