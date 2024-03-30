// models/ClassLevelInfo.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Importa tu instancia Sequelize

const ClassLevelInfo = sequelize.define('ClassLevelInfo', {
  Class: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  level: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  exp: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
    tableName: 'classlevelinfo', 
    timestamps: false, // Evita la creación automática de campos createdAt y updatedAt
});

export default ClassLevelInfo;
