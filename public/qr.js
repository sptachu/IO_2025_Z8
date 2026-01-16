// qr.js

// Funkcja pomocnicza do wyświetlania komunikatów błędów
function showError(msg) {
    const errDiv = document.getElementById('error-message');
    errDiv.innerText = msg;
    errDiv.style.display = 'block';
    setTimeout(() => { errDiv.style.display = 'none'; }, 5000);
}

// Funkcja renderująca kod QR
function displayQRCode(token) {
    const display = document.getElementById('qr-display');
    // Zmieniamy size na 300x300 dla lepszej ostrości na dużych ekranach telefonów
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(token)}`;

    display.innerHTML = `
        <img src="${qrUrl}" alt="Twój Kod QR" id="qr-image">
        <p style="color: #28a745; font-weight: bold; margin-top: 15px; font-size: 18px;">KOD AKTYWNY</p>
    `;

    // Blokujemy przycisk na czas aktywności kodu (opcjonalnie)
    document.getElementById('qrButton').disabled = true;

    // Po 60 sekundach przywracamy możliwość generowania
    setTimeout(() => {
        display.innerHTML = '<p id="qr-placeholder">Kod wygasł. Wygeneruj nowy.</p>';
        document.getElementById('qrButton').disabled = false;
    }, 60000);
}

// 1. Sprawdzanie czy kod już istnieje (wywoływane przy starcie)
async function checkQR() {
    try {
        const res = await fetch('/api/checkForQR', { method: 'POST' });
        
        if (res.status === 401) {
            window.location.href = '/'; // Przekieruj do logowania jeśli brak sesji
            return;
        }

        const data = await res.json();
        if (data.status && data.qrToken) {
            displayQRCode(data.qrToken);
        }
    } catch (err) {
        console.error("Błąd podczas sprawdzania QR:", err);
    }
}

// 2. Obsługa przycisku generowania
document.getElementById('qrButton').addEventListener('click', async () => {
    const btn = document.getElementById('qrButton');
    const display = document.getElementById('qr-display');
    
    btn.disabled = true;
    display.innerHTML = '<p>Generowanie...</p>';

    try {
        const res = await fetch('/api/generate-qr', { method: 'POST' });
        
        if (res.status === 401) {
            alert("Sesja wygasła. Zaloguj się ponownie.");
            window.location.href = '/';
            return;
        }

        const data = await res.json();

        if (data.status === 'success') {
            displayQRCode(data.qrToken);
        } else {
            showError(data.error || "Nie udało się wygenerować kodu");
            display.innerHTML = '<p>Spróbuj ponownie</p>';
            btn.disabled = false;
        }
    } catch (err) {
        console.error("Błąd generowania:", err);
        showError("Błąd połączenia z serwerem");
        display.innerHTML = '<p>Błąd sieci</p>';
        btn.disabled = false;
    }
});

// 3. Wylogowanie
document.getElementById("logoutButton").onclick = function () {
    document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.href = '/';
};

// Uruchomienie sprawdzenia przy starcie strony
window.addEventListener('DOMContentLoaded', checkQR);