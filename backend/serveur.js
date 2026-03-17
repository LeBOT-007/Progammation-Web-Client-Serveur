const bcrypt = require('bcrypt');
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

// Route pour la connexion
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        
        const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        
        if (rows.length === 0) {
            return res.status(401).json({ error: "Utilisateur non trouvé." });
        }

        const user = rows[0];

        
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ error: "Mot de passe incorrect." });
        }

        
        res.json({ 
            message: "Connexion réussie ! 🔓", 
            user: { id: user.id, nom: user.nom, role: user.role } 
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route pour l'inscription
app.post('/inscription', async (req, res) => {
    const { nom, email, password, role, specialite } = req.body;
    try {
        // On "hache" le mot de passe (10 est le niveau de sécurité)
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sql = "INSERT INTO users (nom, email, password, role, specialite) VALUES (?, ?, ?, ?, ?)";
        await db.query(sql, [nom, email, hashedPassword, role, specialite || null]);
        
        res.status(201).json({ message: "Utilisateur créé en toute sécurité ! 🔐" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route pour voir les disponibilités
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

// Route pour réserver un rendez-vous
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

// Route pour voir les rendez-vous d'un patient
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

// Route pour ANNULER un rendez-vous
app.delete('/annuler-rdv/:id', async (req, res) => {
    const rdvId = req.params.id;

    try {
        // 1. On récupère les infos du RDV avant de le supprimer pour savoir quel créneau libérer
        const [rdv] = await db.query("SELECT doctor_id, date_heure FROM appointments WHERE id = ?", [rdvId]);

        if (rdv.length === 0) {
            return res.status(404).json({ error: "Rendez-vous non trouvé." });
        }

        const { doctor_id, date_heure } = rdv[0];

        // 2. On supprime le rendez-vous
        await db.query("DELETE FROM appointments WHERE id = ?", [rdvId]);

        // 3. On remet le créneau du docteur en 'libre'
        await db.query(
            "UPDATE availabilities SET statut = 'libre' WHERE doctor_id = ? AND date_heure = ?",
            [doctor_id, date_heure]
        );

        res.json({ message: "Rendez-vous annulé et créneau libéré ! 🗑️" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route pour récupérer la liste de tous les soignants
app.get('/medecins', async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, nom, specialite FROM users WHERE role = 'soignant'"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/profil/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, nom, email, role, specialite FROM users WHERE id = ?", [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: "Profil introuvable." });
        res.json(rows[0]);
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