// models/UserAsset.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar tu instancia de Sequelize

const UserAsset = sequelize.define('UserAsset', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true, // Especificar que es clave primaria
    autoIncrement: true, // Como es un id, es probable que sea auto-incremental
  },
  user: {
    type: DataTypes.STRING(11), // 'user' es de tipo varchar(11)
    allowNull: false,
  },
  asset: {
    type: DataTypes.INTEGER(11), // 'asset' es de tipo int(11)
    allowNull: false,
    comment: 'Tipo de asset: 0 piedra de cash, piedra de oro, tickets, etc...',
  },
  amount: {
    type: DataTypes.INTEGER(11), // 'amount' es de tipo int(11)
    allowNull: false,
    comment: 'Cantidad que tiene de ese asset',
  }
}, {
  tableName: 'userassets', // Nombre de la tabla en la base de datos
  timestamps: false, // No se utilizan createdAt ni updatedAt
});

export default UserAsset;
