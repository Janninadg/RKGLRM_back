import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const ExchangeRate = sequelize.define('exchangerate', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  cambio: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
}, {
  tableName: 'exchangerate', // Nombre de la tabla en la base de datos
  timestamps: false // Si no tienes columnas de timestamps (createdAt y updatedAt)
});

export default ExchangeRate;
