// Importa las dependencias necesarias
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Define el modelo para la tabla setitems
const SetItem = sequelize.define('setitems', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  itemid: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  idset: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  }
}, {
  tableName: 'setitems',
  timestamps: false
});

// Exporta el modelo SetItem
export default SetItem;
