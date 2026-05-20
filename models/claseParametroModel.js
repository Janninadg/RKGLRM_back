import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ClaseParametro = sequelize.define('clase_parametro', {
  id: {
    type: DataTypes.TINYINT(3),
    primaryKey: true,
    allowNull: false,
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
}, {
  tableName: 'clase_parametro',
  timestamps: false,
});

export default ClaseParametro;
