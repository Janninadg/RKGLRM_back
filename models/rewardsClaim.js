// models/RewardClaim.js
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; // Asegúrate de que la ruta sea la correcta

const RewardClaim = sequelize.define('reward_claims', {
  id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true,      // Clave primaria
    autoIncrement: true,   // AUTO_INCREMENT
  },
  user_id: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  },
  claim_date: {
    type: DataTypes.DATEONLY,  // Almacena solo la fecha (YYYY-MM-DD)
    allowNull: true,
    defaultValue: null,
  },
  created_at: {
    type: DataTypes.DATE,      
    allowNull: true,
    defaultValue: DataTypes.NOW, // Por defecto, se asigna current_timestamp()
  }
}, {
  tableName: 'reward_claims', // Nombre de la tabla en la BD
  timestamps: false,          // Deshabilita los campos automáticos createdAt y updatedAt
  indexes: [
    {
      name: 'user_daily_claim',
      unique: true,
      fields: ['user_id', 'claim_date']  // Índice compuesto para asegurar un único reclamo por usuario y día
    }
  ],
});

export default RewardClaim;
