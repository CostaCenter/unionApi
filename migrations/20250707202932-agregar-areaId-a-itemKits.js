'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('itemKits', 'areaId', { // Asegúrate que tu tabla se llame 'itemKits'
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Areas', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('itemKits', 'areaId');
  }
};