// login.js

// Pobieramy referencję do formularza logowania
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        // Blokujemy domyślne przeładowanie strony po wysłaniu formularza
        e.preventDefault();

        // Pobieramy wartości z pól wejściowych
        const name = document.getElementById('nameInput').value;
        const password = document.getElementById('passwordInput').value;

        try {
            // Wysyłamy żądanie POST do endpointu obsługującego logowanie
            const response = await fetch('/api/login-handle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, password }) //
            });

            const data = await response.json();

            // Jeśli serwer potwierdził poprawne dane
            if (data.status) {
                // Ustawiamy ciasteczko 'user' z identyfikatorem UUID otrzymanym od serwera
                // max-age=86400 ustawia ważność ciasteczka na 24 godziny
                document.cookie = `user=${data.uuid}; path=/; max-age=86400`;

                // Przekierowujemy użytkownika na stronę główną
                // Serwer sprawdzi ciasteczko i wyświetli odpowiedni panel (QR lub Admin)
                window.location.href = '/';
            } else {
                // Wyświetlamy błąd w przypadku niepowodzenia
                alert("Błędne dane logowania. Spróbuj ponownie.");
            }
        } catch (error) {
            console.error("Błąd podczas logowania:", error);
            alert("Wystąpił problem z połączeniem z serwerem.");
        }
    });
}