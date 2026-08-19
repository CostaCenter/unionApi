'use strict';

/**
 * Fase 1 — servicio_libre en comprasCotizacionItems
 * Ejecutar: node scripts/migrate-comprasCotizacionItem-servicio-libre.js
 * o vía arranque del servidor (index.js).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'comprasCotizacionItems';
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [nullableCols] = await queryInterface.sequelize.query(
        `
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = :table
          AND column_name IN ('materiaId', 'productoId', 'materiumId')
        `,
        { replacements: { table }, transaction }
      );

      for (const col of nullableCols) {
        if (col.is_nullable === 'NO') {
          await queryInterface.sequelize.query(
            `ALTER TABLE "${table}" ALTER COLUMN "${col.column_name}" DROP NOT NULL`,
            { transaction }
          );
          console.log(`[migration] ${col.column_name} → nullable`);
        }
      }

      const [tipoCol] = await queryInterface.sequelize.query(
        `
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :table AND column_name = 'tipo'
        LIMIT 1
        `,
        { replacements: { table }, transaction }
      );

      if (!tipoCol.length) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "${table}" ADD COLUMN "tipo" VARCHAR(32)`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `
          ALTER TABLE "${table}"
          ADD CONSTRAINT "chk_comprasCotizacionItems_tipo"
          CHECK ("tipo" IS NULL OR "tipo" IN ('material', 'producto', 'servicio_libre'))
          `,
          { transaction }
        );
      }

      const [descCol] = await queryInterface.sequelize.query(
        `
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :table AND column_name = 'descripcionLibre'
        LIMIT 1
        `,
        { replacements: { table }, transaction }
      );

      if (!descCol.length) {
        await queryInterface.sequelize.query(
          `ALTER TABLE "${table}" ADD COLUMN "descripcionLibre" TEXT`,
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `
        UPDATE "${table}"
        SET "tipo" = 'producto'
        WHERE "tipo" IS NULL AND "productoId" IS NOT NULL
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE "${table}"
        SET "tipo" = 'material'
        WHERE "tipo" IS NULL
          AND ("materiaId" IS NOT NULL OR "materiumId" IS NOT NULL)
        `,
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const table = 'comprasCotizacionItems';
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "chk_comprasCotizacionItems_tipo"`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "descripcionLibre"`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tipo"`,
        { transaction }
      );
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
