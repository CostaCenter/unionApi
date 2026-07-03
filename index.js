const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes, INTEGER } = require('sequelize');
const cloudinary = require('cloudinary');
const cors = require('cors');
const { Server } = require("socket.io");
const http = require("http");
require('dotenv').config();
 
const { db, Op } = require('./src/db/db');
const routes = require('./src/routes');
const { isAuthenticated } = require('./src/controllers/user');
const { initSocketManager } = require('./src/sockets/socketManager');

const app = express();
const server = http.createServer(app); // Usamos http para socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Guardar io en app para usarlo en controladores
app.set("io", io);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  next();
}); 

app.use(cors({ origin: "*", credentials: true }));

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Rutas
app.get('/', (req, res) => {
  res.send('Running Server to ERP Union - Costa Center');
});

app.get('/sign/user', isAuthenticated, (req, res) => {
  try {
    res.status(200).json({ user: req.user });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: 'Ha ocurrido un error en la principal.' });
  }
});

app.use('/api', routes);

// Endpoint temporal para probar las notificaciones en tiempo real
app.get('/api/test-notification/:userId', (req, res) => {
  const io = req.app.get("io");

  const mockNotification = {
    id: "prueba-123",
    title: "¡Prueba de Fuego Exitosa! 🎉",
    body: "Si estás viendo esto, el sistema de notificaciones está vivo.",
    category: "system",
    created_at: new Date()
  };

  // 📢 CAMBIA ESTA LÍNEA: Quitamos el .to(userId) para que vaya a TODO el mundo
  io.emit("new_notification", mockNotification);

  return res.json({ 
    success: true, 
    msg: "Notificación global enviada con éxito" 
  });
});

// Socket.IO — inicializar manager (auth, salas privadas + eventos existentes)
initSocketManager(io);

// Levantar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  try {
    // Sincronizar sin alter para evitar problemas con datos existentes
    await db.sync({ force: false });
    
    // Agregar columna 'name' a tabla adjunts si no existe (de forma segura)
    try {
      await db.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'adjunts' AND column_name = 'name'
          ) THEN
            ALTER TABLE adjunts ADD COLUMN name VARCHAR(255);
          END IF;
        END $$;
      `);
      console.log('✅ Columna "name" verificada/agregada a tabla adjunts');
    } catch (colError) {
      console.log('⚠️  Error al agregar columna name:', colError.message);
    }

    try {
      await db.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'requiredKits' AND column_name = 'parentRequerimientoId'
          ) THEN
            ALTER TABLE "requiredKits" ADD COLUMN "parentRequerimientoId" INTEGER REFERENCES "requiredKits"(id) ON UPDATE CASCADE ON DELETE CASCADE;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'requiredKits' AND column_name = 'esContenedor'
          ) THEN
            ALTER TABLE "requiredKits" ADD COLUMN "esContenedor" BOOLEAN NOT NULL DEFAULT false;
          END IF;
        END $$;
      `);
      console.log('✅ Columnas padre-hijo verificadas/agregadas en requiredKits');
    } catch (colError) {
      console.log('⚠️  Error al agregar columnas padre-hijo:', colError.message);
    }

    try {
      await db.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'requiredKits' AND column_name = 'extensionId'
          ) THEN
            ALTER TABLE "requiredKits" ADD COLUMN "extensionId" INTEGER REFERENCES "extensions"(id) ON UPDATE CASCADE ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'requiredKits' AND column_name = 'leidoCompras'
          ) THEN
            ALTER TABLE "requiredKits" ADD COLUMN "leidoCompras" BOOLEAN NOT NULL DEFAULT false;
          END IF;
        END $$;
      `);
      console.log('✅ Columnas extensionId y leidoCompras verificadas en requiredKits');
    } catch (colError) {
      console.log('⚠️  Error al agregar columnas fase 2:', colError.message);
    }
    
    console.log(`Server running on port ${PORT}`);
  } catch (err) {
    console.error('❌ Error en sincronización de base de datos:', err);
  }
});
