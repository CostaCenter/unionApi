const { Sequelize, Op} = require('sequelize');

// Importe.
const modelUser = require('./model/user'); // User
const modelProveedor = require('./model/proveedor'); // Proveedor

const modelLinea = require('./model/linea'); // Busqueda por linea
const modelCategoria = require('./model/categoria'); // Busqueda por categoría

const modelMateria = require('./model/materiaPrima'); // Materia Prima
const modelProducto = require('./model/productoFinal'); // Producto final 

const modelExtension = require('./model/extension'); // Extensiones para productos de venta.

const modelPrice = require('./model/price'); // Tabla de Precios Materia Prima
const modelProductPrice = require('./model/productPrice'); // Tabla precios de producto terminado
const modelKit = require('./model/kit'); // Tabla de kits

const modelItemKit = require('./model/itemKit'); // Item.

const modelClient = require('./model/client'); // Cliente
const modelCotizacion = require('./model/cotizacion'); // Cotización
const modelVersionCotizacion = require('./model/cotizacionVersion'); // Versión de las cotizaciones
const modelNotasCotizacion = require('./model/notasCotización'); // Notas cotización
const modelAreaCotizacion = require('./model/areaCotizacion');
const modelKitCotizacion = require('./model/kitCotizacion');
const modelProductoCotizacion = require('./model/productoCotizacion');

// ARMADOS PARA COTIZACIÓN
const modelArmado = require('./model/armado'); // Armar elementos
const modelArmadoKit = require('./model/armadoKit'); // Relación kits y armado
const modelArmadoCotizacion = require('./model/armadoCotizacion'); // Relacion Armado y cotización
// SERVICIOS
const modelService = require('./model/servicios');
const modelServiceCotizacion = require('./model/serviciosCotizacion');


// PARTE COMPRAS ALMACEN
const modelInventario = require('./model/inventario'); // Inventario
const modelUbicacion = require('./model/ubicacion'); // Ubicación.
const modelMovimientoInventario = require('./model/movimientosInventario'); // Movimiento en inventario

const modelRequisicion = require('./model/requisicion');
const modelLogs = require('./model/logs');
const modelPorcentajes = require('./model/porcentajes');

// PERMISOS DENTRO DE LA APLICACIÓN
const modelPermisos = require('./model/permission');
const modelUserPermission = require('./model/user_permission');


const entorno = true;     
let dburl = entorno ? 'postgresql://postgres:mnfPuhNtcXTFhlurmBdslUBftGBFMZau@centerbeam.proxy.rlwy.net:41058/railway' : 'postgres:postgres:123@localhost:5432/u';
 
const sequelize = new Sequelize(dburl, {
    logging: false,
    native: false,
    // dialect: 'postgres',
    // dialectOptions: {
    //   ssl: {
    //     require: true,
    //     rejectUnauthorized: false
    //   }
    // },
    // pool: {
    //   max: 5,
    //   min: 0,
    //   acquire: 30000, 
    //   idle: 10000
    // }
}); 
  
 
    
// Modelos
modelUser(sequelize);
modelProveedor(sequelize);
modelLinea(sequelize);
modelCategoria(sequelize);
modelMateria(sequelize);
modelProducto(sequelize);
modelExtension(sequelize);

// Materia Prima Precios
modelPrice(sequelize);
modelProductPrice(sequelize);

// Kits
modelKit(sequelize);

// Relacion itemKit
modelItemKit(sequelize);

// CLIENTE Y COTIZACIÓN
modelClient(sequelize);
modelCotizacion(sequelize);
modelVersionCotizacion(sequelize);
modelNotasCotizacion(sequelize);
modelAreaCotizacion(sequelize);
modelKitCotizacion(sequelize);
modelKitCotizacion(sequelize);
modelProductoCotizacion(sequelize);
modelArmado(sequelize);
modelArmadoCotizacion(sequelize);
modelArmadoKit(sequelize);
modelService(sequelize);
modelServiceCotizacion(sequelize);
// COMPRAS E INVENTARIO
// modelInventario(sequelize);
// modelUbicacion(sequelize);
// modelMovimientoInventario(sequelize); 

modelRequisicion(sequelize); 
modelLogs(sequelize);
modelPorcentajes(sequelize);

// PERMISOS
modelPermisos(sequelize);
modelUserPermission(sequelize);


const { user, proveedor, linea, categoria, materia, producto, extension, price, productPrice, kit, itemKit,
  client, versionCotizacion, cotizacion, notaCotizacion, armado, kitCotizacion, requisicion, armadoCotizacion, armadoKits, log, percentage,
  permission, service, serviceCotizacion, user_permission, areaCotizacion, productoCotizacion
} = sequelize.models; 


// RELACIONES 


// PERMISOS DE USUARIO
user.belongsToMany(permission, {
  through: user_permission,
  foreignKey: 'userId',
  as: 'permissions'
});

permission.belongsToMany(user, {
  through: user_permission,
  foreignKey: 'permissionId',
  as: 'users'
}); 
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

// PRODUCTOS
// Relación uno a muchos
linea.hasMany(producto, {
  foreignKey: 'lineaId', // Clave foránea en la tabla contact
  onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
});
producto.belongsTo(linea);

// Relación uno a muchos
categoria.hasMany(producto, {
foreignKey: 'categoriumId',
  onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
});  
producto.belongsTo(categoria); 



// Relacion de porcentajes con la categoría
linea.hasMany(percentage, {
  foreignKey: 'lineaId'
})
percentage.belongsTo(linea);
 
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


// PRODUCTO TERMINADO, PROVEEDORES Y PRECIO
producto.hasMany(productPrice, {
  onDelete: 'CASCADE',
})
productPrice.belongsTo(producto)

proveedor.hasMany(productPrice, {
  onDelete: 'CASCADE',
})
productPrice.belongsTo(proveedor)

 


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

user.hasMany(log, {
  foreignKey: 'userId'
});
log.belongsTo(user)

// CLIENTES Y COTIZACIÓN
// -----------------------


// Relación uno a muchos
client.hasMany(cotizacion, {
  foreignKey: 'clientId', // Clave foránea en la tabla contact
  onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
});
cotizacion.belongsTo(client); 

versionCotizacion.hasMany(cotizacion); // VersionCotización contiene muchas cotizaciones
cotizacion.belongsTo(versionCotizacion);  // Relacionamos la cotizacion con versiones.

// // Relación uno a muchos - Usuario
user.hasMany(cotizacion, {
  foreignKey: 'userId', // Clave foránea en la tabla contact
  onDelete: 'CASCADE',    // Opcional: elimina los posts si se elimina el usuario
}); 
cotizacion.belongsTo(user); 
 
// Relación Muchos a muchos
areaCotizacion.belongsToMany(kit, { 
  through: kitCotizacion, // Nombre de la tabla intermedia
  foreignKey: 'areaId' 
}); 

kit.belongsToMany(areaCotizacion, { 
  through: kitCotizacion, 
  foreignKey: 'kitId' 
}); 


// areaCotizacion.belongsToMany(producto, { 
//   through: productoCotizacion, // Nombre de la tabla intermedia
//   foreignKey: 'areaId' 
// });

// producto.belongsToMany(areaCotizacion, { 
//   through: productoCotizacion, 
//   foreignKey: 'productoId' 
// });
// AÑADIR ESTAS LÍNEAS
areaCotizacion.hasMany(productoCotizacion, { foreignKey: 'areaId', });
productoCotizacion.belongsTo(areaCotizacion, { foreignKey: 'areaId' });

producto.hasMany(productoCotizacion, { foreignKey: 'productoId' });
productoCotizacion.belongsTo(producto, { foreignKey: 'productoId' });
 

cotizacion.hasMany(areaCotizacion, {
  onDelete: 'CASCADE',
}) 
areaCotizacion.belongsTo(cotizacion);

// Relación cotización y las notas e imagenes
cotizacion.hasMany(notaCotizacion);
notaCotizacion.belongsTo(cotizacion, {
  foreignKey: 'cotizacionId'
})

// KITCOTIZACION
areaCotizacion.hasMany(kitCotizacion)
kitCotizacion.belongsTo(areaCotizacion)

areaCotizacion.hasMany(armadoCotizacion)
armadoCotizacion.belongsTo(areaCotizacion)

areaCotizacion.hasMany(productoCotizacion)
productoCotizacion.belongsTo(areaCotizacion);

// user.hasOne(cotizacion, { 
//   foreignKey: 'userId',
//   onDelete: 'CASCADE'
// });
// cotizacion.belongsTo(user, {
//   foreignKey: 'userId',
// });



// ARMAR PRODUCTOS CON KITS
armado.belongsToMany(kit, { 
  through: 'armadoKits', // Nombre de la tabla intermedia
  foreignKey: 'armadoId' 
});

kit.belongsToMany(armado, { 
  through: 'armadoKits', 
  foreignKey: 'kitId' 
});

areaCotizacion.belongsToMany(armado, { 
  through: armadoCotizacion, // Nombre de la tabla intermedia
  foreignKey: 'areaId' 
}); 

armado.belongsToMany(areaCotizacion, { 
  through: armadoCotizacion, 
  foreignKey: 'armadoId' 
}); 

// En tu archivo de asociaciones (ej: db.js)

// 1. Relación entre Área y la Línea de Servicio
areaCotizacion.hasMany(serviceCotizacion, { 
    foreignKey: 'areaCotizacionId',
    as: 'serviciosCotizados' 
});
serviceCotizacion.belongsTo(areaCotizacion, { 
    foreignKey: 'areaCotizacionId' 
});


// 2. Relación entre el Catálogo de Servicios y la Línea de Servicio
service.hasMany(serviceCotizacion, { 
    foreignKey: 'servicioId' 
});
serviceCotizacion.belongsTo(service, { 
    foreignKey: 'servicioId' 
});
 

cotizacion.hasMany(requisicion, {
  as: 'requisiciones',
});

requisicion.belongsTo(cotizacion);
 
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