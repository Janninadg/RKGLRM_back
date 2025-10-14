import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const LogRewardsUser = sequelize.define('LogRewardsUser', {
  id: {
    type: DataTypes.INTEGER(11),
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  user: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  origen: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  recompensa: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  tipo_recompensa: {
    type: DataTypes.INTEGER(11),
    allowNull: false
  },
  origen_2: {
    type: DataTypes.INTEGER(11),
    allowNull: true // Permitir nulos ya que puede ser NULL según la descripción
  },
  last_pr: {
    type: DataTypes.BIGINT(20),
    allowNull: true // Permitir nulos ya que puede ser NULL según la descripción
  },
   curr_pr: {
    type: DataTypes.BIGINT(20),
    allowNull: true // Permitir nulos ya que puede ser NULL según la descripción
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'logrewardsusers',
  timestamps: false
});

export default LogRewardsUser;
