// models/RefineryLog.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de importar tu instancia de Sequelize

const RefineryLog = sequelize.define('RefineryLog', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true, // Especificar que es clave primaria
    autoIncrement: true, // Es auto-incremental
  },
  user: {
    type: DataTypes.STRING(11), // 'user' es de tipo varchar(11)
    allowNull: false,
  },
  itemid: {
    type: DataTypes.INTEGER(11), // 'itemid' es de tipo int(11)
    allowNull: false,
  },
  currentlevel: {
    type: DataTypes.INTEGER(11), // 'itemid' es de tipo int(11)
    allowNull: false,
  },
  refinerystate: {
    type: DataTypes.INTEGER(11), // 'refinerystate' es de tipo int(11)
    allowNull: false,
  },
  typeasset: {
    type: DataTypes.INTEGER(11), // 'typeasset' es de tipo int(11)
    allowNull: false,
  },
  fecha: {
    type: DataTypes.DATE, // 'fecha' es de tipo datetime
    allowNull: false,
  }
}, {
  tableName: 'refinerylogs', // Nombre de la tabla en la base de datos
  timestamps: false, // No se utilizan createdAt ni updatedAt
});

export default RefineryLog;
