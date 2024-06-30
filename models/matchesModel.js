import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const Matches = sequelize.define('matches', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  partida: {
    type: DataTypes.TEXT('medium'),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  premios_obtenidos: {
    type: DataTypes.TEXT('medium'),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  picked: {
    type: DataTypes.TEXT,
    collate: 'utf8mb4_general_ci',
  },
  nombres: {
    type: DataTypes.TEXT('medium'),
    collate: 'utf8mb4_general_ci',
  },
  game: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
  },
  estado: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'matches',
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default Matches;
