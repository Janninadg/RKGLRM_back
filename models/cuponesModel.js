import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const Cupon = sequelize.define('cupon', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  ticket: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  limite: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 10
  },
  users: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    defaultValue: 0
  },
  type: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  id_prize: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  name_prize: {
    type: DataTypes.STRING(100),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  uri: {
    type: DataTypes.STRING(20),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
}, {
  tableName: 'cupones', // Nombre de la tabla en la base de datos
  timestamps: false // Si no tienes columnas de timestamps (createdAt y updatedAt)
});

export default Cupon;
