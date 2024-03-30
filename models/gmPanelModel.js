import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Ajusta la ruta a tu archivo de configuración de la base de datos

const PanelGM = sequelize.define('panelgm', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
  },
  user: {
    type: DataTypes.STRING(11),
    allowNull: false,
    collate: 'utf8_general_ci',
  },
}, {
  tableName: 'panelgm', 
  timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default PanelGM;
