import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ConfigParameters = sequelize.define('configparameters', {
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'configparameters',
  timestamps: false
});

export default ConfigParameters;
