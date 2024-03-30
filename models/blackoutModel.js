// Importa Sequelize y la conexión a la base de datos si aún no lo has hecho
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de ajustar la ruta a tu archivo de configuración de Sequelize

// Define el modelo Blackout
const Blackout = sequelize.define('Blackout', {
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName: 'blackout', // Nombre de la tabla en la base de datos (ajusta según tu configuración)
  timestamps: false, // Si no deseas que Sequelize agregue automáticamente campos de registro de tiempo
});

// Exporta el modelo Blackout
export default Blackout;
