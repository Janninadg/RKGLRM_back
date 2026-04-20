import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.js'; // Ajusta la ruta según tu proyecto

const PaymentMethods = sequelize.define('payment_methods', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  icon: {
    type: DataTypes.STRING(255),
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: true,
    collate: 'utf8mb4_general_ci',
  },
  type: {
    type: DataTypes.ENUM('INTERNAL', 'EXTERNAL','EXCHANGE'),
    allowNull: false,
    collate: 'utf8mb4_general_ci',
  },
  auto_settle: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true,
  },
}, {
  tableName: 'payment_methods',
  timestamps: false, // sin createdAt/updatedAt automáticos
});

export default PaymentMethods;
