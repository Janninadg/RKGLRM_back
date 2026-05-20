import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ConfigParameters = sequelize.define('configparameters', {
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },
  description: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  isparameter: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 0
  },
  tipo: {
    type: DataTypes.TINYINT(2),
    allowNull: false,
    defaultValue: 0,
    comment: '0: general, 1: juego'
  },
  clase: {
    type: DataTypes.TINYINT(2),
    allowNull: false,
    defaultValue: 2,
    comment: '0: boolean, 1: numeric, 2: texto'
  }
}, {
  tableName: 'configparameters',
  timestamps: false
});

export default ConfigParameters;
