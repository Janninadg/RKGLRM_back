import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RecargasPack = sequelize.define('recargaspack', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  cash: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  oro: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
  puntos: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'recargaspack',
  timestamps: false,
});

export default RecargasPack;
