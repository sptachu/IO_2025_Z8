//server.js
require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const app = express();
const upload = multer({ dest: 'uploads/' });
const gateUpload = multer({ dest: 'gateUploads/'})
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const pythonPath = process.env.PYTHON_PATH || 'py';

app.use(cookieParser());
app.use(express.static('public'));
app.use(express.json());

// --- KONFIGURACJA BAZY DANYCH ---
const adapter = new FileSync('db.json');
const db = low(adapter);

// Lista aktywnych sesji w RAM (czyści się po restarcie) ---
const activeSessions = new Set();

// Ustawiamy puste tablice, jeśli plik db.json jeszcze nie istnieje
db.defaults({ users: [], accessLogs: [] }).write();

// --- INICJALIZACJA UŻYTKOWNIKÓW ---

const adminExists = db.get('users').find({ id: 1 }).value();
if (!adminExists) {
    db.get('users').push({
        id: 1,
        name: "admin",
        password: "admin",
        uuid: uuidv4(),
        photoPath: "",
        activeQrToken: false,
        blocked: false,
        role: "admin"
    }).write();
    console.log("Dodano użytkownika: admin");
}

const testExists = db.get('users').find({ id: 2 }).value();
if (!testExists) {
    db.get('users').push({
        id: 2,
        name: "test",
        password: "test",
        uuid: uuidv4(),
        photoPath: "",
        activeQrToken: false,
        blocked: false,
        role: "worker"
    }).write();
    console.log("Dodano użytkownika: test");
}

// --- ENDPOINTY ---
// REJESTRACJA PRACOWNIKA (ADMIN)
app.post('/api/add-employee', upload.single('photo'), (req, res) => {
    const { name, employeeId, password } = req.body;
    const imagePath = req.file.path;

    // Uruchomienie Pythona w celu "stworzenia wektora twarzy"
    const pythonProcess = spawn(pythonPath, ['./check_face.py', imagePath]);
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
                // 1. Sprawdzamy czy user istnieje (używamy funkcji, żeby zachować "==" czyli ignorowanie typu liczby/tekstu)
                const existingUser = db.get('users').find(u => u.id == employeeId).value();

                if (!existingUser) {
                    // 2. Jeśli NIE istnieje (!existingUser), to dodajemy
                    db.get('users').push({
                        id: employeeId,
                        name: name,
                        password: password,
                        uuid: uuidv4(),
                        photoPath: imagePath,
                        activeQrToken: false,
                        blocked: false,
                        role: "worker"
                    }).write();

                    console.log(`[Rejestracja]: Dodano pracownika ${name} (${employeeId})`);
                    res.json({ status: 'success', userId: employeeId });

                } else {
                    // 3. Jeśli istnieje, zwracamy błąd
                    console.log(`[Rejestracja]: Pokrywające się id, nie dodano pracownika`);
                    res.json({ status: 'failure'});
                }
            } else {
                console.log(`[Rejestracja]: Nie wykryto twarzy na zdjęciu`);
                res.json({ status: 'no_face_detected'});
            }
        } catch (e) {
            res.status(500).send("Błąd analizy zdjęcia");
        }
    });
});


app.post('/api/generate-qr', (req, res) => {
    const cookies = req.cookies;

    // Sprawdzamy czy użytkownik ma ciasteczko
    if (cookies.user) {

        const user = db.get('users').find({ uuid: cookies.user }).value();
        if (!user) return res.status(404).json({ error: "Nie znaleziono pracownika" });

        if (user.blocked) {
            return res.json({ status: 'failure', error: 'Twoje konto jest zablokowane. Brak dostępu.' });
        }

        if (!user.activeQrToken) {

            // Generowanie treści tokena
            const qrToken = `QR_${user.id}_${Date.now()}`;

            // Zapisanie tokena w bazie
            db.get('users')
              .find({ uuid: cookies.user })
              .assign({ activeQrToken: qrToken })
              .write();

            // Ustawienie wygasania (Timeout 5 minut)
            setTimeout(() => {
                // Wewnątrz setTimeout też musimy użyć .write(), bo to dzieje się później
                db.get('users')
                  .find({ uuid: cookies.user })
                  .assign({ activeQrToken: false })
                  .write();

                console.log(`QR for ${user.name} has expired and been cleared.`);
            }, 300000);

            console.log(`Użytkownik ${user.name} wygenerował kod QR`);
            res.json({ status: 'success', qrToken: qrToken });

        } else {
            res.json({ status: 'failure', error: 'Kod QR jest już aktywny' });
        }
    } else {
        // Jeśli nie ma ciasteczka
        res.status(401).json({ error: "Brak autoryzacji" });
    }
});

app.post('/api/generate-qr-admin', (req, res) => {
    const { employeeId } = req.body;

    // Szukamy usera w bazie db.json
    const user = db.get('users').find(u => u.id == employeeId).value();

    if (!user) return res.status(404).json({ error: "Nie znaleziono pracownika" });

    if (!user.activeQrToken) {
        // Generowanie tokena
        const qrToken = `QR_${employeeId}_${Date.now()}`;

        // Zapisujemy token do bazy plikowej
        db.get('users')
          .find(u => u.id == employeeId)
          .assign({ activeQrToken: qrToken })
          .write(); // Zapis na dysk

        setTimeout(() => {
            db.get('users')
              .find(u => u.id == employeeId)
              .assign({ activeQrToken: false })
              .write();
            console.log(`QR dla użytkownika ${user.name} wygasł`);
        }, 300000);

        console.log(`[Admin]: Wygenerowano QR dla ${user.name}`);
        res.json({ status: 'success', qrToken: qrToken });
    } else {
        res.json({ status: 'failure', error: 'Kod QR jest już aktywny' });
    }
});

app.post('/api/checkForQR', (req, res) => {
    const cookies = req.cookies;

    //  Pobieramy usera z bazy
    const user = db.get('users').find({ uuid: cookies.user }).value();

    if (user && user.activeQrToken) {
        res.json({ status: true, qrToken: user.activeQrToken });
    } else {
        res.json({status: false})
    }
})


app.post('/api/verify-entry', gateUpload.single('gatePhoto'), (req, res) => {
    const { qrToken } = req.body; // Odczytany kod QR
    const gateImagePath = req.file.path; // Zdjęcie z kamery na bramce

    const timestamp = new Date().toISOString();
    let accessGranted = false;
    let denialReason = null;
    let identifiedUser = null;

    // KROK 1: Weryfikacja QR (Czy istnieje i czy ważny)
    const user = db.get('users').find({ activeQrToken: qrToken }).value();

    if (!user) {
        // SCENARIUSZ: Próba wejścia na nieważny/fałszywy bilet
        denialReason = "Nieprawidłowa przepustka";
        logAttempt(null, "Nieznany", false, denialReason, timestamp, gateImagePath);
        return res.json({ status: 'denied', message: denialReason });
    }

    identifiedUser = user.name;

    // KROK 2: Sprawdzenie uprawnień
    if (user.blocked) {
        denialReason = "Pracownik zablokowany/Brak uprawnień";
        logAttempt(user.id, user.name, false, denialReason, timestamp, gateImagePath);
        return res.json({ status: 'denied', message: denialReason });
    }

    // KROK 3: Weryfikacja Biometryczna (Python)
    // Uruchamiamy skrypt na zdjęciu z bramki, żeby sprawdzić, czy to "twarz"
    const pythonProcess = spawn(pythonPath, ['./compare_faces.py', gateImagePath, user.photoPath]);
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
                logAttempt(user.id, user.name, true, "OK", timestamp, gateImagePath);
                res.json({
                    status: 'allowed',
                    message: `Witaj, ${user.name}!`,
                    details: jsonResult.message
                });
            } else {
                logAttempt(user.id, user.name, false, denialReason, timestamp, gateImagePath);
                res.json({ status: 'denied', message: denialReason });
            }

        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Błąd serwera weryfikacji" });
        }
    });
});



app.post('/api/toggle-block-user', (req, res) => {
    const { uuid, block } = req.body;

    const user = db.get('users').find({ uuid: uuid }).value();

    // Zabezpieczenie przed zablokowaniem głównego admina
    if (user && user.role === 'admin' && user.id === 1) {
        return res.json({ status: 'failure', error: 'Nie można zablokować głównego administratora.' });
    }

    // Przygotowujemy zmiany
    let updates = { blocked: block };

    // --- NOWOŚĆ: Jeśli blokujemy (block === true), to niszczymy token QR ---
    if (block) {
        updates.activeQrToken = false;
    }
    // -----------------------------------------------------------------------

    db.get('users')
      .find({ uuid: uuid })
      .assign(updates) // Zapisujemy zmiany (blokada + ew. usunięcie tokena)
      .write();

    console.log(`[Admin]: Zmieniono status blokady dla ${user.name} na ${block}`);
    res.json({ status: 'success' });
});

app.post('/api/delete-user', (req, res) => {
    const { uuid } = req.body;

    // Nie pozwól usunąć głównego admina
    const user = db.get('users').find({ uuid: uuid }).value();
    if (user && user.role === 'admin' && user.id === 1) {
        return res.json({ status: 'failure', error: 'Nie można usunąć głównego administratora.' });
    }

    // Usuwamy z bazy
    db.get('users')
      .remove({ uuid: uuid })
      .write();

    // (Opcjonalnie) Tutaj można by też usunąć plik zdjęcia z folderu uploads używając fs.unlink

    console.log(`[Admin]: Usunięto pracownika ${user ? user.name : 'nieznany'}`);
    res.json({ status: 'success' });
});

app.get('/api/get-employees', (req, res) => {
    // Pobieramy wszystkich z bazy
    const users = db.get('users').value();

    // Filtrujemy dane wrażliwe (nie wysyłamy hasła ani ścieżki do zdjęcia)
    const safeUsers = users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        uuid: u.uuid,
        blocked: u.blocked
    }));

    res.json(safeUsers);
});


app.get('/api/logs', (req, res) => {
    // 1. Pobieramy logi z bazy danych
    const logs = db.get('accessLogs').value();

    // 2. Wysyłamy odwrócone (najnowsze na górze)
    if (logs) {
        res.json(logs.slice().reverse());
    } else {
        res.json([]);
    }
});


app.post('/api/login-handle', (req, res) => {
    let loginInfo = req.body

    // 1. Sprawdzamy czy user istnieje w bazie (trwałe dane)
    const user = db.get('users').find({
        name: loginInfo.name,
        password: loginInfo.password
    }).value();

    if (user){
        // 2. Dodajemy go do aktywnych sesji w RAM
        activeSessions.add(user.uuid);

        res.json({status: true, uuid: user.uuid})
    } else {
        res.json({status: false})
    }
})

app.get('/', (req, res) => {
    let cookies = req.cookies
    let pageToSend = checkCookie(cookies)
    res.sendFile(pageToSend, { root: '.' });
})

app.get('/gate', (req, res) => {
    res.sendFile('./protected/gate.html', { root: '.' });
});

// Funkcja pomocnicza do pobierania obrazów
app.get('/api/download-photo/:filename', (req, res) => {
    const fileName = req.params.filename;

    const filePath = path.join(__dirname, fileName);

    const hash = path.basename(filePath);
    const downloadName = `Gate_Photo_${hash}.jpg`;
    
    res.download(filePath, downloadName, (err) => {
        if (err) {
            console.error("File failed to download:", err);
            res.status(404).send("Photo not found.");
        }
    });
});

// Funkcja pomocnicza do logowania
function logAttempt(userId, userName, success, reason, time, photoPath) {
    const entry = { userId, userName, success, reason, time, photoPath };

    db.get('accessLogs').push(entry).write();
    console.log(`[BRAMKA]: ${success ? 'WEJŚCIE' : 'ODMOWA'} -> ${userName} (${reason})`);
}

// Funkcja pomocnicza do sprawdzania ciasteczek
function checkCookie(cookies){
    if (cookies.user) {

        if (!activeSessions.has(cookies.user)) {
            return('./protected/login.html');
        }

        // Jeśli jest w RAM, to pobieramy szczegóły z bazy
        const user = db.get('users').find({ uuid: cookies.user }).value();

        if (user && user.role === "admin"){
            return('./protected/adminPage.html');
        }
        else if (user && user.role === "worker") {
            return('./protected/qr.html');
        }
    }
    return('./protected/login.html');
}

app.listen(3000, () => console.log('System Kontroli Dostępu (Server + Kiosk) działa na porcie 3000'));