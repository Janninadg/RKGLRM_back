// Importa Sequelize y la conexión a la base de datos si aún no lo has hecho
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de ajustar la ruta a tu archivo de configuración de Sequelize

// Define el modelo TokenSession
const TokenSession = sequelize.define('tokensession', {
  id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    primaryKey: true,
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: true, // Cambiar a "false" si no se permite un valor nulo
  },
}, {
  tableName: 'tokensession', // Nombre de la tabla en la base de datos (ajusta según tu configuración)
  timestamps: false, // Si no deseas que Sequelize agregue automáticamente campos de registro de tiempo
});

// Exporta el modelo TokenSession
export default TokenSession;
