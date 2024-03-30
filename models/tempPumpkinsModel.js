import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const TempPumpkins = sequelize.define('temp_pumpkins', {
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
  calabazas: {
    type: DataTypes.TEXT('medium'),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  premios: {
    type: DataTypes.TEXT('medium'),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  picked: {
    type: DataTypes.TEXT,
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  nombres: {
    type: DataTypes.TEXT('medium'),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  game: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
  },
  estado: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'temp_pumpkins',
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default TempPumpkins;
