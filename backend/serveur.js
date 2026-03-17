const express = require('express');
const cors = require('cors');
const db = require('./db'); // Importation de ta connexion Railway
require('dotenv').config();

const app = express();

// --- MIDDLEWARES ---
app.use(cors()); // Autorise le Frontend à parler au Backend
app.use(express.json()); // Permet de lire le format JSON envoyé par Postman

// --- 1. ROUTE DE TEST ---
app.get('/', (req, res) => {
    res.send("🚀 Serveur de santé opérationnel !");
});

// --- 2. INSCRIPTION (Table: users) ---
app.post('/inscription', async (req, res) => {
    const { nom, email, password, role, specialite } = req.body;

    if (!nom || !email || !password || !role) {
        return res.status(400).json({ error: "Champs obligatoires manquants." });
    }

    try {
        const sql = "INSERT INTO users (nom, email, password, role, specialite) VALUES (?, ?, ?, ?, ?)";
        const [result] = await db.query(sql, [nom, email, password, role, specialite || null]);
        res.status(201).json({ message: "Utilisateur créé !", userId: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "Email déjà utilisé." });
        res.status(500).json({ error: err.message });
    }
});

// --- 3. CONNEXION (Table: users) ---
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        if (rows.length === 0 || rows[0].password !== password) {
            return res.status(401).json({ error: "Identifiants incorrects." });
        }
        res.json({ message: "Bienvenue !", user: { id: rows[0].id, nom: rows[0].nom, role: rows[0].role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 4. VOIR LES DISPOS (Table: availabilities) ---
app.get('/disponibilites', async (req, res) => {
    try {
        const sql = `
            SELECT a.id, u.nom AS medecin, u.specialite, a.date_heure 
            FROM availabilities a
            JOIN users u ON a.doctor_id = u.id
            WHERE a.statut = 'libre'
        `;
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 5. RÉSERVER UN RDV (Table: appointments) ---
app.post('/reserver', async (req, res) => {
    const { patient_id, doctor_id, date_heure } = req.body;

    if (!patient_id || !doctor_id || !date_heure) {
        return res.status(400).json({ error: "Données manquantes (patient_id, doctor_id ou date_heure)." });
    }

    try {
        // Ajouter le rendez-vous
        const sqlAppoint = "INSERT INTO appointments (patient_id, doctor_id, date_heure, statut) VALUES (?, ?, ?, 'en_attente')";
        await db.query(sqlAppoint, [patient_id, doctor_id, date_heure]);

        // Marquer le créneau comme indisponible
        const sqlUpdate = "UPDATE availabilities SET statut = 'indisponible' WHERE doctor_id = ? AND date_heure = ?";
        await db.query(sqlUpdate, [doctor_id, date_heure]);

        res.status(201).json({ message: "Rendez-vous enregistré ! ✅" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 6. VOIR MES RDV (Table: appointments) ---
app.get('/mes-rendez-vous/:patient_id', async (req, res) => {
    const patientId = req.params.patient_id;
    try {
        const sql = `
            SELECT app.id, u.nom AS medecin, app.date_heure, app.statut
            FROM appointments app
            JOIN users u ON app.doctor_id = u.id
            WHERE app.patient_id = ?
        `;
        const [rows] = await db.query(sql, [patientId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- LANCEMENT ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`✅ Serveur : http://localhost:${PORT}`);
    console.log(`=========================================\n`);
});