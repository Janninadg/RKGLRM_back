import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const Streamer = sequelize.define('streamer', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  // Otras columnas si es necesario agregar más
}, {
  tableName: 'streamers', // Nombre de la tabla en la base de datos
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default Streamer;
