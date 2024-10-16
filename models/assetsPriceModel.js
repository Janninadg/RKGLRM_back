// models/AssetPrice.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar tu instancia de Sequelize

const AssetPrice = sequelize.define('AssetPrice', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true, // Definir como clave primaria
    autoIncrement: true, // Auto-incremental para el campo id
  },
  asset: {
    type: DataTypes.INTEGER(11), // Identificador del tipo de asset
    allowNull: false,
    comment: 'Tipo de asset',
  },
  multiple: {
    type: DataTypes.TINYINT(1), // tinyint para valores booleanos (1 o 0)
    allowNull: false,
    defaultValue: 0, // Valor por defecto 0
  },
  price: {
    type: DataTypes.TEXT, // Almacenar múltiples precios o un solo valor
    allowNull: false,
    comment: 'Si es múltiple [100,200], si no, solo 100 (ejemplo)',
  },
  currency: {
    type: DataTypes.TEXT, // Almacenar múltiples o un solo tipo de moneda
    allowNull: false,
    comment: 'Tipo de moneda: 0 cash, 1 oro, 2 puntos de evento, etc.',
  },
  show: {
    type: DataTypes.TINYINT(1),
    allowNull: false,
    defaultValue: 1
  },
  img: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
}, {
  tableName: 'assetsprice', // Nombre de la tabla en la base de datos
  timestamps: false, // No se utilizan createdAt ni updatedAt
});

export default AssetPrice;
