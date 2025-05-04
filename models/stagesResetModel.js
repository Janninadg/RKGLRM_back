import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const StagesReset = sequelize.define('stagesreset', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  idStage: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  name: {
    type: DataTypes.TEXT,
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  visible: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'stagesreset',
  timestamps: false,
});

export default StagesReset;
