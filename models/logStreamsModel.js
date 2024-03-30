import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const LogStream = sequelize.define('logstreams', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  prize: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  type: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  cupon: {
    type: DataTypes.STRING(25),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'logstreams', // Nombre de la tabla en la base de datos
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default LogStream;
