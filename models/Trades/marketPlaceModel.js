import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const Marketplace = sequelize.define('marketplace', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  itemid: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  vendedor: {
    type: DataTypes.STRING(50),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  precio: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  medio_pago: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  estado: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'marketplace',
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default Marketplace;
