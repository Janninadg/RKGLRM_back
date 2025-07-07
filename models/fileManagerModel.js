import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const FileManager = sequelize.define('FileManager', {
  ID: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  FileName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    collate: 'latin1_swedish_ci',
  },
  SerialID: {
    type: DataTypes.STRING(255),
    allowNull: true,
    collate: 'latin1_swedish_ci',
  },
  Length: {
    type: DataTypes.INTEGER(11),
    allowNull: false,
  }
}, {
  tableName: 'filemanager',
  timestamps: false,
});

export default FileManager;
