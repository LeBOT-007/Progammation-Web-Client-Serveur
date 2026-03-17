const mysql = require('mysql2');
require('dotenv').config();

// On crée le "pool" de connexion (plusieurs connexions prêtes à l'emploi)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// La ligne MAGIQUE qui transforme MySQL en version moderne (Promise)
const promisePool = pool.promise();

// Un petit test pour confirmer la connexion dans la console au démarrage
pool.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Erreur Railway : Impossible de se connecter !", err.message);
    } else {
        console.log("✅ Connexion à Railway réussie !");
        connection.release();
    }
});

module.exports = promisePool;