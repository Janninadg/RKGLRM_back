import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta si es necesario

const WebUser = sequelize.define('webuser', {
  user: {
    type: DataTypes.STRING(11),
    primaryKey: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING(11),
    allowNull: false,
  },
}, {
  tableName: 'webusers', // Asegúrate de que el nombre coincide con el de tu tabla
  timestamps: false,
});

export default WebUser;
