const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes, INTEGER } = require('sequelize');
const cloudinary = require('cloudinary');
const cors = require('cors');
const { Server } = require("socket.io");
const http = require("http"); // ojo, aquí estaba mal escrito
require('dotenv').config();

const { db, Op } = require('./src/db/db');
const routes = require('./src/routes');
const { isAuthenticated } = require('./src/controllers/user');

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
  res.send('Running Server to CRM comercial - Costa Center');
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

// Socket.IO - conexión
io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  // Unirse a un requerimiento
  socket.on("join:requerimiento", (reqId) => {
    socket.join(`req:${reqId}`);
    console.log(`Cliente ${socket.id} se unió a la sala req:${reqId}`);
  });

  // Cuando se envía un mensaje
  socket.on("send:message", (reqId, mensaje) => {
    console.log(`Mensaje en req:${reqId}:`, mensaje);

    // Aquí puedes guardar el mensaje en la BD...

    // Emitir a TODOS en la sala, incluido el emisor
    io.to(`req:${reqId}`).emit("requerimiento:update", {
      reqId,
      mensaje
    });
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

// Levantar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  db.sync({ force: false });
  console.log(`Server running on port ${PORT}`);
});
