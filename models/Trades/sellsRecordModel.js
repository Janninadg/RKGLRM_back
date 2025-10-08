import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const SellsRecord = sequelize.define('sellsrecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  id_market: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  buyer: {
    type: DataTypes.TEXT,
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'sellsrecord',
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default SellsRecord;
