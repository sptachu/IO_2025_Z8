// --- FUNKCJE OBSŁUGI KAMERY (NOWE) ---

// Inicjalizacja strumienia wideo dla danej kamery
async function setupCamera(videoId) {
    const video = document.getElementById(videoId);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        console.log(`Kamera ${videoId} uruchomiona.`);
    } catch (err) {
        console.error("Błąd dostępu do kamery:", err);
        alert("Nie można uzyskać dostępu do kamery. Upewnij się, że masz podłączone urządzenie i nadałeś uprawnienia.");
    }
}

// Przechwycenie zdjęcia z elementu video i zamiana na Blob (plik)
function capturePhoto(videoId) {
    const video = document.getElementById(videoId);
    const canvas = document.getElementById('snapshotCanvas');

    if (!video.srcObject) return null;

    // Ustawienie wymiarów canvasu na wymiary wideo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Narysowanie aktualnej klatki na ukrytym canvasie
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Konwersja canvasu na Blob (format JPEG)
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.9);
    });
}

// --- 1. ADMIN: REJESTRACJA PRACOWNIKA (Z AKTUALIZACJĄ KAMERY) ---
const addWorkerForm = document.getElementById('addWorkerForm');
if(addWorkerForm) {
    addWorkerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const photoBlob = await capturePhoto('adminVideo');
        if (!photoBlob) {
            alert("Najpierw uruchom kamerę i upewnij się, że widać Twoją twarz!");
            return;
        }

        const formData = new FormData(e.target);
        // Dodajemy przechwycone zdjęcie do formularza pod nazwą 'photo'
        formData.append('photo', photoBlob, 'employee_capture.jpg');

        const resultDiv = document.getElementById('add-result');
        resultDiv.innerText = "Rejestrowanie w bazie...";

        const res = await fetch('/api/add-employee', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.status === 'success') {
            resultDiv.innerText = `Dodano pracownika ID: ${data.userId}`;
            resultDiv.style.color = 'green';
        } else if (data.status === 'no_face_detected') {
            resultDiv.innerText = "Błąd: Nie wykryto twarzy na zdjęciu z kamery.";
            resultDiv.style.color = 'red';
        } else if (data.status === "failure") {
            resultDiv.innerText = "Błąd: pokrywające się ID.";
            resultDiv.style.color = 'red';
        } 
        else {
            resultDiv.innerText = "Błąd: " + JSON.stringify(data);
            resultDiv.style.color = 'red';
        }
    });
}

// --- 2. ADMIN: GENEROWANIE QR ---
async function generateQR() {
    const empId = document.getElementById('qrEmployeeId').value;
    const display = document.getElementById('qr-display');

    if (!empId) {
        alert("Wpisz ID pracownika!");
        return;
    }

    const res = await fetch('/api/generate-qr-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId })
    });
    const data = await res.json();

    if (data.status === 'success') {
        display.innerHTML = `
            <p style="color:green; font-weight:bold;">Wygenerowano!</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${data.qrToken}">
            <p style="font-size:0.8em;">Token: <b>${data.qrToken}</b></p>
        `;
    } else {
        alert(data.error);
    }
}

// --- 3. KIOSK: SYMULACJA BRAMKI (Z AKTUALIZACJĄ KAMERY) ---
const gateForm = document.getElementById('gateForm');
if(gateForm) {
    gateForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const photoBlob = await capturePhoto('gateVideo');
        const qrToken = document.getElementById('qrTokenInput').value;
        const gateResult = document.getElementById('gate-result');

        if (!photoBlob) {
            alert("Kamera bramki jest wyłączona!");
            return;
        }

        gateResult.innerHTML = "Weryfikacja biometryczna w toku...";
        gateResult.className = "";

        // Przygotowanie danych do wysyłki
        const formData = new FormData();
        formData.append('qrToken', qrToken);
        formData.append('gatePhoto', photoBlob, 'gate_capture.jpg');

        try {
            const res = await fetch('/api/verify-entry', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.status === 'allowed') {
                gateResult.innerHTML = `✅ Dostęp Przyznany! <br> ${data.message}`;
                gateResult.className = "success-box";
            } else {
                gateResult.innerHTML = `❌ ODMOWA DOSTĘPU <br> Powód: ${data.message}`;
                gateResult.className = "error-box";
            }

            loadLogs();
        } catch (err) {
            console.error(err);
        }
    });
}

// --- 4. ADMIN: POBIERANIE RAPORTÓW ---
async function loadLogs() {
    const tableBody = document.querySelector('#logsTable tbody');
    if(!tableBody) return;

    const res = await fetch('/api/logs');
    const logs = await res.json();

    tableBody.innerHTML = logs.map(log => `
        <tr style="background-color: ${log.success ? '#d4edda' : '#f8d7da'}">
            <td>${log.time.split('T')[1].split('.')[0]}</td>
            <td>${log.userName}</td>
            <td>${log.success ? '✅ SUKCES' : '⛔ BLOKADA'}</td>
            <td>${log.reason}</td>
        </tr>
    `).join('');
}

// --- FUNKCJA WYŁĄCZANIA KAMERY (NOWA) ---
function stopCamera(videoId) {
    const video = document.getElementById(videoId);
    const stream = video.srcObject;

    if (stream) {
        // Pobierz wszystkie ścieżki (wideo/audio) i zatrzymaj każdą z nich
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());

        // Usuń strumień z elementu video
        video.srcObject = null;
        console.log(`Kamera ${videoId} została wyłączona.`);
    }
}

document.getElementById("logoutButton").onclick = async function () {
    document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    location.reload()
}

// --- 5. ZARZĄDZANIE PRACOWNIKAMI ---

// Pobieranie i wyświetlanie listy pracowników
async function loadEmployees() {
    const tableBody = document.querySelector('#employeesTable tbody');
    if(!tableBody) return;

    const res = await fetch('/api/get-employees');
    const users = await res.json();

    tableBody.innerHTML = users.map(user => {
        // Nie pozwól usuwać/blokować samego siebie (Admina)
        const isAdmin = user.role === 'admin';
        const blockBtnText = user.blocked ? 'Odblokuj' : 'Zablokuj';
        const blockBtnColor = user.blocked ? '#28a745' : '#ffc107'; // Zielony / Żółty

        return `
        <tr style="background-color: ${user.blocked ? '#f8d7da' : 'white'}">
            <td>${user.id}</td>
            <td>${user.name} ${isAdmin ? '👑' : ''}</td>
            <td>${user.role}</td>
            <td>
                ${!isAdmin ? `
                <button onclick="toggleBlock('${user.uuid}', ${user.blocked})" 
                        style="width: auto; padding: 5px; background: ${blockBtnColor}; color: black;">
                    ${blockBtnText}
                </button>
                <button onclick="deleteUser('${user.uuid}')" 
                        style="width: auto; padding: 5px; background: #dc3545;">
                    Usuń
                </button>
                ` : '<span style="color:gray">Brak akcji</span>'}
            </td>
        </tr>
    `}).join('');
}

// Funkcja blokowania/odblokowania
async function toggleBlock(uuid, currentStatus) {
    if(!confirm(`Czy na pewno chcesz ${currentStatus ? 'odblokować' : 'zablokować'} tego pracownika?`)) return;

    const res = await fetch('/api/toggle-block-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: uuid, block: !currentStatus }) // Wysyłamy odwrotność obecnego stanu
    });

    const data = await res.json();
    if(data.status === 'success') {
        loadEmployees(); // Odśwież tabelę
    } else {
        alert("Błąd: " + data.error);
    }
}

// Funkcja usuwania użytkownika
async function deleteUser(uuid) {
    if(!confirm("Czy na pewno chcesz trwale usunąć tego pracownika? Tej operacji nie można cofnąć.")) return;

    const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: uuid })
    });

    const data = await res.json();
    if(data.status === 'success') {
        loadEmployees(); // Odśwież tabelę
    } else {
        alert("Błąd: " + data.error);
    }
}

// Dodaj wywołanie przy starcie, żeby tabela nie była pusta
loadEmployees();

// Załaduj logi przy starcie
loadLogs();