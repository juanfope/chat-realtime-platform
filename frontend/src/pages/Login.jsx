import { useState } from "react";
import { login } from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const [username, setUser] = useState("");
    const [password, setPass] = useState("");
    const navigate = useNavigate();

    async function handleLogin() {
        try {
            const { token } = await login(username, password);
            localStorage.setItem("token", token);
            navigate("/chat");
        } catch {
            alert("Usuario o contraseña incorrectos");
        }
    }

    return (
        <div style={{ padding: 20 }}>
            <h2>Iniciar sesión</h2>
            <input placeholder="Usuario" value={username} onChange={e => setUser(e.target.value)} /><br /><br />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPass(e.target.value)} /><br /><br />
            <button onClick={handleLogin}>Entrar</button>
        </div>
    );
}
