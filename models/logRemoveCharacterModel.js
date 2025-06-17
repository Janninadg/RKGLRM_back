import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta si es necesario

const LogRemoveCharacter = sequelize.define('logremovecharacter', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.CHAR(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  charname: {
    type: DataTypes.CHAR(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  slot: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'logremovecharacter',
  timestamps: false, // No se usan createdAt ni updatedAt
});

export default LogRemoveCharacter;
