'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('requiredKits', 'parentRequerimientoId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'requiredKits', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.addColumn('requiredKits', 'esContenedor', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('requiredKits', 'esContenedor');
    await queryInterface.removeColumn('requiredKits', 'parentRequerimientoId');
  },
};
