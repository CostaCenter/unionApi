'use strict';
const tableName = 'productoCotizacions'; // Asegúrate que este sea el nombre correcto

module.exports = {
  async up (queryInterface, Sequelize) {
    console.log(`Buscando y eliminando la restricción UNIQUE de la tabla ${tableName}...`);

    // ¡IMPORTANTE! Reemplaza 'nombre_de_la_restriccion_unique' con el nombre
    // exacto que viste en pgAdmin en el paso anterior.
    const constraintName = 'productoCotizacions_areaId_productoId_key'; 

    await queryInterface.removeConstraint(tableName, constraintName);

    console.log(`Restricción '${constraintName}' eliminada con éxito.`);
  },

  async down (queryInterface, Sequelize) {
    // La función 'down' vuelve a crear la restricción si necesitas revertir
    const constraintName = 'productoCotizacions_areaId_productoId_key';
    await queryInterface.addConstraint(tableName, {
        fields: ['areaId', 'productoId'],
        type: 'unique',
        name: constraintName
    });
  }
};