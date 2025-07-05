import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const User = sequelize.define('user', {
  id: {
    type: DataTypes.STRING(11),
    primaryKey: true,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // apodo: {
  //   type: DataTypes.STRING(11),
  //   allowNull: false,
  // },
  e_mail: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  country: {
    type: DataTypes.SMALLINT(6),
    allowNull: false,
    defaultValue: 0,
  },
  NoCountryUpdate: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  Authority: {
    type: DataTypes.INTEGER(4),
    allowNull: false,
    defaultValue: 0,
  },
},{
  tableName: 'user', // Nombre de la tabla en la base de datos
  timestamps: false, // Si no tienes columnas de timestamps (createdAt y updatedAt)
});


export default User;