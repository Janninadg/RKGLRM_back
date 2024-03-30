import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TypeLogsGM = sequelize.define('typelogsgm', {
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
  tableName: 'typelogsgm',
  timestamps: false
});

export default TypeLogsGM;
