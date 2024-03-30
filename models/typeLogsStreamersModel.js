import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TypeLogsStreamers = sequelize.define('typelogsstreamers', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'typelogsstreamers',
  timestamps: false
});

export default TypeLogsStreamers;
