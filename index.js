const express = require('express');
const bodyParser = require('body-parser');
const {Sequelize,  DataTypes, INTEGER } = require('sequelize');
const cloudinary = require('cloudinary');
const cors = require('cors');
require('dotenv').config(); // Carga las variables de entorno

const {db, Op } = require('./src/db/db');

const app = express();
app.use(express.json()); 

const routes = require('./src/routes');
const { isAuthenticated } = require('./src/controllers/user');
// const isAuthenticated = require('./src/controllers/authentication');

const PORT = process.env.PORT || 3000;


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Usa https
});

app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // update to match the domain you will make the request from
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  next();
});

// Ruta de iniciacion
const corstOptions = {
  origin: '*',
  credentials: true
}
app.use(cors(corstOptions))


app.get('/', (req, res)  => {
    res.send('Running Server to CRM comercial - Costa Center'); 
})
 
app.get('/sign/user', isAuthenticated, (req, res) => {
  try{
    console.log(req.user);
    console.log('entra');
    res.status(200).json({user: req.user})
  }catch(err){
    console.log(err);
    res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
  }
})

// app.get('/sign/user',  isAuthenticated, (req, res) => {
//   try {
//     console.log(req.user);
//     console.log('entra')
//     res.status(200).json({user: req.user});
//   }catch(err){
//     console.log(err);
//     res.status(500).json({msg: 'error en la principal'});
//   }
// })

app.use('/api', routes)



const server = app.listen(PORT, () => {
    db.sync({force: false}); 
    console.log(`Server running on port ${PORT}`);
});