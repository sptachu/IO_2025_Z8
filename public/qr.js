document.getElementById("logoutButton").onclick = async function () {
    document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    location.reload()
}

document.getElementById("qrButton").onclick = async function () {
    const display = document.getElementById('qr-display');

    const res = await fetch('/api/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (data.status === 'success') {
        display.innerHTML = `
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${data.qrToken}">
            <p style="font-size:0.8em;">Token: <b>${data.qrToken}</b></p>
        `;
    } else {
        alert(data.error);
    }
}

async function checkQR() {
    const display = document.getElementById('qr-display');

    const res = await fetch('/api/checkForQR', {
        method: 'POST',
    });
    const data = await res.json();

    if (data.status) {
        display.innerHTML = `
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${data.qrToken}">
            <p style="font-size:0.8em;">Token: <b>${data.qrToken}</b></p>
        `;
    }
}
