import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const TipoParametro = sequelize.define('tipo_parametro', {
  id: {
    type: DataTypes.TINYINT(3),
    primaryKey: true,
    allowNull: false,
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
}, {
  tableName: 'tipo_parametro',
  timestamps: false,
});

export default TipoParametro;
