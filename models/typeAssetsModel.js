// models/TypeAsset.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar tu instancia de Sequelize

const TypeAsset = sequelize.define('TypeAsset', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true, // Definir como clave primaria
    autoIncrement: true, // Auto-incremental para el campo id
  },
  tipo: {
    type: DataTypes.STRING(50), // varchar(50)
    allowNull: false,
    comment: 'Descripción del tipo de asset',
  },
}, {
  tableName: 'typeassets', // Nombre de la tabla en la base de datos
  timestamps: false, // No se utilizan createdAt ni updatedAt
});

export default TypeAsset;
