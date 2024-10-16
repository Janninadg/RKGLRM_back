import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const Streamer = sequelize.define('streamer', {
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
  platform: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    comment: '0: tiktok, 1: twitch, 2: youtube...',
  },
  link: {
    type: DataTypes.TEXT,
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  status: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
}, {
  tableName: 'streamers', // Nombre de la tabla en la base de datos
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default Streamer;
