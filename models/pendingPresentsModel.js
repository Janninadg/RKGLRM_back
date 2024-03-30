import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const PendingPresents = sequelize.define('pendingpresents', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  present_id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  },
  user_id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  },
  added_time: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: '0000-00-00 00:00:00'
  }
}, {
  tableName: 'pendingpresents', // Nombre de la tabla en la base de datos
  timestamps: false // Si no tienes columnas de timestamps (createdAt y updatedAt)
});

export default PendingPresents;
