import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const Banlist = sequelize.define('banlist', {
  UserName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  HWID: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  UserIP: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
   PrivateHwid: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  Reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
  }
}, {
  tableName: 'banlist', // Nombre de la tabla en la base de datos
  timestamps: false, // Si no tienes columnas de timestamps (createdAt y updatedAt)
  freezeTableName: true, // Para que el nombre de la tabla sea igual al nombre del modelo
  omitNull: true, // Esto evita que Sequelize agregue una columna 'id'
});

Banlist.removeAttribute('id');

export default Banlist;
