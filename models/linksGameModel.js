// Importa los módulos necesarios de Sequelize
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

// Define el modelo Linksgame
const Linksgame = sequelize.define('linksgame', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  type: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  link: {
    type: DataTypes.TEXT('medium'),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  ref: {
    type: DataTypes.STRING(11),
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
}, {
  tableName: 'linksgame',
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default Linksgame;
