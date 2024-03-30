import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const UserBarItem = sequelize.define('userbaritem', {
  userid: {
    type: DataTypes.STRING(11),
    primaryKey: true,
    allowNull: false
  },
  porcentaje: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'userbaritem', // Nombre de la tabla en la base de datos
  timestamps: false // Si no tienes columnas de timestamps (createdAt y updatedAt)
});

export default UserBarItem;
