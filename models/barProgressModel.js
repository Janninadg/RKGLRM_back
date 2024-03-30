import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const BarraConexion = sequelize.define('barraconexion', {
  User: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    allowNull: false,
    //collate: 'utf8_general_ci',
  },
  BarCount: {
    type: DataTypes.INTEGER(1),
    allowNull: true,
  },
  ResTime: {
    type: DataTypes.INTEGER(11),
    allowNull: true,
  },
}, {
  tableName: 'barraconexion', 
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default BarraConexion;