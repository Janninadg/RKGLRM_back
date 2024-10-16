import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const StreamPlatform = sequelize.define('streamplatform', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
}, {
  tableName: 'streamplatforms', // Nombre de la tabla en la base de datos
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default StreamPlatform;
