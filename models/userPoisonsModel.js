import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Definir el modelo UserPoisons
const UserPoisons = sequelize.define('userpoisons', {
    id: {
      type: DataTypes.INTEGER(11),
      primaryKey: true,
      allowNull: false,
      autoIncrement: true,
    },
    user: {
      type: DataTypes.STRING(11),
      allowNull: false,
      collate: 'utf8mb4_general_ci',
    },
    idpocion: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
    },
    cantidad: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
    },
  }, {
    tableName: 'userpoisons',
    timestamps: false, // Evitar la creación automática de campos createdAt y updatedAt
  });
  
  // Exportar el modelo UserPoisons
  export default UserPoisons;