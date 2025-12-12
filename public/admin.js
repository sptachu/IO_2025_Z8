
// --- 1. ADMIN: DODAWANIE PRACOWNIKA ---
const addWorkerForm = document.getElementById('addWorkerForm');
if(addWorkerForm) {
    addWorkerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const resultDiv = document.getElementById('add-result');
        resultDiv.innerText = "Rejestrowanie...";

        const res = await fetch('/api/add-employee', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.status === 'success') {
            resultDiv.innerText = `Dodano pracownika ID: ${data.userId}`;
            resultDiv.style.color = 'green';
        } else {
            resultDiv.innerText = "Błąd: " + JSON.stringify(data);
        }
    });
}

// --- 2. ADMIN: GENEROWANIE QR ---
async function generateQR() {
    const empId = document.getElementById('qrEmployeeId').value;
    const display = document.getElementById('qr-display');

    const res = await fetch('/api/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId })
    });
    const data = await res.json();

    if (data.status === 'success') {
        display.innerHTML = `
            <p style="color:green">Wygenerowano!</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${data.qrToken}">
            <p>Token: <b>${data.qrToken}</b> <br> (Skopiuj ten token do symulatora bramki!)</p>
        `;
    } else {
        display.innerHTML = `<p style="color:red">${data.error}</p>`;
    }
}

// --- 3. KIOSK: SYMULACJA WEJŚCIA (BRAMKA) ---
const gateForm = document.getElementById('gateForm');
if(gateForm) {
    gateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const gateResult = document.getElementById('gate-result');

        gateResult.innerHTML = "Weryfikacja biometryczna w toku...";
        gateResult.className = "";

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
            <td>${log.time.split('T')[1].split('.')[0]}</td> <td>${log.userName}</td>
            <td>${log.success ? '✅ SUKCES' : '⛔ BLOKADA'}</td>
            <td>${log.reason}</td>
        </tr>
    `).join('');
}

// Załaduj logi przy starcie
loadLogs();