'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // ❗️ Primero, elimina la restricción vieja. Debes averiguar su nombre exacto.
    await queryInterface.removeConstraint('itemKits', 'itemKits_kitId_materiaId_key');
    // Luego, agrega la nueva restricción
    await queryInterface.addConstraint('itemKits', {
      fields: ['kitId', 'materiaId', 'areaId'],
      type: 'unique',
      name: 'unique_item_in_area_per_kit'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('itemKits', 'unique_item_in_area_per_kit');
    await queryInterface.addConstraint('itemKits', {
      fields: ['kitId', 'materiaId'],
      type: 'unique',
      name: 'itemKits_kitId_materiaId_key' // Recrea la restricción original
    });
  }
};