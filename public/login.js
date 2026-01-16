const loginForm = document.getElementById('loginForm');
if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {name: document.getElementById("nameInput").value, password: document.getElementById("passwordInput").value};
        const res = await fetch('/api/login-handle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        const data = await res.json();

        if (data.status){
            document.cookie = "user="+data.uuid;
            location.reload()
        } else {
            alert("Niepoprawne dane logowania")
        }
    })
}