const { Sequelize, Op} = require('sequelize');

// Importe.
const modelUser = require('./model/user'); // User
const modelProveedor = require('./model/proveedor'); // Proveedor

const modelLinea = require('./model/linea'); // Busqueda por linea
const modelCategoria = require('./model/categoria'); // Busqueda por categoría

const modelMateria = require('./model/materiaPrima'); // Materia Prima

const modelExtension = require('./model/extension'); // Extensiones para productos de venta.

const modelPrice = require('./model/price'); // Tabla de Precios Materia Prima
const modelKit = require('./model/kit'); // Tabla de kits

const modelItemKit = require('./model/itemKit'); // Item.

const modelClient = require('./model/client'); // Cliente
const modelCotizacion = require('./model/cotizacion'); // Cotización
const modelKitCotizacion = require('./model/kitCotizacion');

// PARTE COMPRAS ALMACEN
const modelInventario = require('./model/inventario'); // Inventario
const modelUbicacion = require('./model/ubicacion'); // Ubicación.
const modelMovimientoInventario = require('./model/movimientosInventario'); // Movimiento en inventario
const entorno = true;   

let dburl = entorno ? 'postgresql://postgres:mnfPuhNtcXTFhlurmBdslUBftGBFMZau@centerbeam.proxy.rlwy.net:41058/railway' : 'postgres:postgres:123@localhost:5432/u';
 
const sequelize = new Sequelize(dburl, {
    logging: false,
    native: false,
});
  
 
    
// Modelos
modelUser(sequelize);
modelProveedor(sequelize);
modelLinea(sequelize);
modelCategoria(sequelize);
modelMateria(sequelize);
modelExtension(sequelize);

// Materia Prima Precios
modelPrice(sequelize);

// Kits
modelKit(sequelize);

// Relacion itemKit
modelItemKit(sequelize);

// CLIENTE Y COTIZACIÓN
modelClient(sequelize);
modelCotizacion(sequelize);
modelKitCotizacion(sequelize);


// COMPRAS E INVENTARIO
// modelInventario(sequelize);
// modelUbicacion(sequelize);
// modelMovimientoInventario(sequelize); 

const { user, proveedor, linea, categoria, materia, extension, price, kit, itemKit,
  client, cotizacion, kitCotizacion,
 } = sequelize.models;


// RELACIONES 
// ------------------------
// LINEAS Y CATEGORÍAS 

// Relación uno a muchos
linea.hasMany(materia, {
    foreignKey: 'lineaId', // Clave foránea en la tabla contact
    onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
  });

materia.belongsTo(linea);

// Relación uno a muchos
categoria.hasMany(materia, {
  foreignKey: 'categoriumId',
    onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
  });  

materia.belongsTo(categoria); 



// ------------------------
// MATERÍA PRIMA, PROVEEDORES Y PRECIOS
materia.hasMany(price, {
  onDelete: 'CASCADE',
})
price.belongsTo(materia)

proveedor.hasMany(price, {
  onDelete: 'CASCADE',
})
price.belongsTo(proveedor)




// KITS 
// -------------------------
// Relación uno a muchos
linea.hasMany(kit, {
  foreignKey: 'lineaId', // Clave foránea en la tabla contact
  onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
});
kit.belongsTo(linea);

// Relación uno a muchos
categoria.hasMany(kit, {
  onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
});  
kit.belongsTo(categoria); 

// Relación uno a muchos
extension.hasMany(kit, {
  onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
});  

kit.belongsTo(extension);  

// KITS. MATERIA PRIMA Y KITS.
// Relación muchos a muchos 
kit.belongsToMany(materia, { 
  through: 'itemKit', // Nombre de la tabla intermedia
  foreignKey: 'kitId' 
});

materia.belongsToMany(kit, { 
  through: 'itemKit', 
  foreignKey: 'materiaId' 
});
 

// CLIENTES Y COTIZACIÓN
// -----------------------

// Relación uno a muchos
client.hasMany(cotizacion, {
  foreignKey: 'clientId', // Clave foránea en la tabla contact
  onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
});
cotizacion.belongsTo(client); 

// Relación Muchos a muchos
cotizacion.belongsToMany(kit, { 
  through: kitCotizacion, // Nombre de la tabla intermedia
  foreignKey: 'cotizacionId' 
});
kit.belongsToMany(cotizacion, { 
  through: kitCotizacion, 
  foreignKey: 'kitId' 
});
  
// ---------------------------
// INVENTARIO Y COMPRAS 
// ---------------------------
// ubicacion.hasMany(inventario, {
//   foreignKey: 'ubicacionId', // Clave foránea en la tabla inventario
//   onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
// })
// inventario.belongsTo(ubicacion); 

// materia.hasMany(inventario, {
//   foreignKey: 'materiumId',
//   onDelete: 'CASCADE'
// })
// inventario.belongsTo(materia)

// // ENLAZO LOS MOVIMIENTOS
// materia.hasMany(movimientoInventario, {
//   foreignKey: 'materiumId',
//   onDelete: 'CASCADE'
// });
// movimientoInventario.belongsTo(materia);

// ubicacion.hasMany(movimientoInventario, {
//   foreignKey: 'ubicacionOrigenId',
//   as: 'origen'
// })
// ubicacion.hasMany(movimientoInventario, {
//   foreignKey: 'ubicacionDestinoId',
//   as: 'destino'
// }) 


// Exportamos.
module.exports = {  
    ...sequelize.models,
    db: sequelize,
    Op
}        