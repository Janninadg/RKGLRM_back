import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const Cash = sequelize.define('cash', {
  id: {
    type: DataTypes.CHAR(16),
    primaryKey: true,
    allowNull: false,
    collate: 'utf8_general_ci',
  },
  cash: {
    type: DataTypes.INTEGER(10),
    allowNull: true,
    defaultValue: 0,
  },
}, {
  tableName: 'cash', 
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default Cash;