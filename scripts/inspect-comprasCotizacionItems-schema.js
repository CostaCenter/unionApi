require('dotenv').config();
const { db } = require('../src/db/db');

(async () => {
  try {
    const [cols] = await db.query(`
      SELECT column_name, is_nullable, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'comprasCotizacionItems'
      ORDER BY ordinal_position
    `);
    console.log(JSON.stringify(cols, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await db.close();
  }
})();
