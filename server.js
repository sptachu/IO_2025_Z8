const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.json());

// --- BAZA DANYCH  ---
const usersDB = [];     // Tutaj trzymamy pracowników
const accessLogs = [];  // Tutaj trzymamy historię wejść (Raporty)

// --- ENDPOINTY ---

// 1. REJESTRACJA PRACOWNIKA (ADMIN)
app.post('/api/add-employee', upload.single('photo'), (req, res) => {
    const { name, employeeId } = req.body;
    const imagePath = req.file.path;

    // Uruchomienie Pythona w celu "stworzenia wektora twarzy"
    const pythonProcess = spawn('py', ['./check_face.py', imagePath]);
    let resultString = '';

    pythonProcess.stdout.on('data', (data) => resultString += data.toString());
    pythonProcess.on('close', (code) => {
        console.log("RAW PYTHON OUTPUT:", resultString);
        try {
            if (!resultString) {
                throw new Error("Python script returned empty result");
            }

            const jsonResult = JSON.parse(resultString);
            
            if (jsonResult.error) {
                console.log("Python returned logical error:", jsonResult.error);
                return res.status(400).json(jsonResult);
            }

            if (jsonResult.status){
                usersDB.push({
                    id: employeeId,
                    name: name,
                    photoPath: imagePath,
                    activeQrToken: null, // Na początku brak przepustki
                    blocked: false       // Domyślnie ma uprawnienia
                });

                console.log(`[Rejestracja]: Dodano pracownika ${name} (${employeeId})`);
                res.json({ status: 'success', userId: employeeId });
            } else {
                console.log(`[Rejestracja]: Nie wykryto twarzy na zdjęciu`);
                res.json({ status: 'no_face_detected'});
            }
        } catch (e) {
            res.status(500).send("Błąd analizy zdjęcia");
        }
    });
});

// 2. GENEROWANIE PRZEPUSTKI (ADMIN)
app.post('/api/generate-qr', (req, res) => {
    const { employeeId } = req.body;
    const user = usersDB.find(u => u.id === employeeId);

    if (!user) return res.status(404).json({ error: "Nie znaleziono pracownika" });

    // Generowanie tokena (ważny np. 1 dzień - tu symulujemy)
    const qrToken = `QR_${employeeId}_${Date.now()}`;
    user.activeQrToken = qrToken;

    console.log(`[Admin]: Wygenerowano QR dla ${user.name}`);
    res.json({ status: 'success', qrToken: qrToken });
});

// 3. BRAMKA WEJŚCIOWA (KIOSK)  ROZBUDOWANE "PROCESS IMAGE"
// Skan QR + Analiza Twarzy
app.post('/api/verify-entry', upload.single('gatePhoto'), (req, res) => {
    const { qrToken } = req.body; // Odczytany kod QR
    const gateImagePath = req.file.path; // Zdjęcie z kamery na bramce

    const timestamp = new Date().toISOString();
    let accessGranted = false;
    let denialReason = null;
    let identifiedUser = null;

    // KROK 1: Weryfikacja QR (Czy istnieje i czy ważny)
    const user = usersDB.find(u => u.activeQrToken === qrToken);

    if (!user) {
        // SCENARIUSZ: Próba wejścia na nieważny/fałszywy bilet
        denialReason = "Nieprawidłowy lub nieważny kod QR";
        logAttempt(null, "Nieznany", false, denialReason, timestamp);
        return res.json({ status: 'denied', message: denialReason });
    }

    identifiedUser = user.name;

    // KROK 2: Sprawdzenie uprawnień
    if (user.blocked) {
        denialReason = "Pracownik zablokowany/Brak uprawnień";
        logAttempt(user.id, user.name, false, denialReason, timestamp);
        return res.json({ status: 'denied', message: denialReason });
    }

    // KROK 3: Weryfikacja Biometryczna (Python)
    // Uruchamiamy skrypt na zdjęciu z bramki, żeby sprawdzić, czy to "twarz"
    const pythonProcess = spawn('py', ['./compare_faces.py', gateImagePath, user.photoPath]);
    let resultString = '';

    pythonProcess.stdout.on('data', (data) => resultString += data.toString());

    pythonProcess.on('close', (code) => {
        console.log("RAW PYTHON OUTPUT:", resultString);
        try {
            const jsonResult = JSON.parse(resultString);
            console.log(jsonResult)

            if (jsonResult.error) {
                denialReason = "Błąd kamery / Nie wykryto twarzy";
                accessGranted = false;
            } else {
                if (!jsonResult.status){
                    denialReason = jsonResult.message
                    accessGranted = false;
                }
                else {
                    accessGranted = true;
                }
            }

            if (accessGranted) {
                logAttempt(user.id, user.name, true, "OK", timestamp);
                res.json({
                    status: 'allowed',
                    message: `Witaj, ${user.name}!`,
                    details: jsonResult.message
                });
            } else {
                logAttempt(user.id, user.name, false, denialReason, timestamp);
                res.json({ status: 'denied', message: denialReason });
            }

        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Błąd serwera weryfikacji" });
        }
    });
});

// 4. RAPORTY (ADMIN) - Endpoint dla panelu administratora
app.get('/api/logs', (req, res) => {
    res.json(accessLogs.reverse()); // Najnowsze na górze
});

// Funkcja pomocnicza do logowania
function logAttempt(userId, userName, success, reason, time) {
    const entry = { userId, userName, success, reason, time };
    accessLogs.push(entry);
    console.log(`[BRAMKA]: ${success ? 'WEJŚCIE' : 'ODMOWA'} -> ${userName} (${reason})`);
}

app.listen(3000, () => console.log('System Kontroli Dostępu (Server + Kiosk) działa na porcie 3000'));