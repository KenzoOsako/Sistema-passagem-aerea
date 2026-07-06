import React, { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const url = isRegister 
      ? `${API_URL}/api/register`
      : `${API_URL}/api/login`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro de autenticação');
      }

      onLoginSuccess(data.token, data.username || username);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="background-decoration"></div>
      <div className="background-decoration-2"></div>
      <div className="login-card">
        <h2>{isRegister ? 'Criar Conta' : 'Bem-vindo de volta'}</h2>
        <p>Acesse o FlyAI para encontrar as melhores passagens.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <input 
            type="text" 
            className="login-input" 
            placeholder="Nome de usuário" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input 
            type="password" 
            className="login-input" 
            placeholder="Senha" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Aguarde...' : (isRegister ? 'Registrar' : 'Entrar')}
          </button>
        </form>

        <button 
          className="login-toggle" 
          onClick={() => {
            setIsRegister(!isRegister);
            setError('');
          }}
        >
          {isRegister ? 'Já tenho uma conta. Fazer login.' : 'Não tenho conta. Criar agora.'}
        </button>
      </div>
    </div>
  );
}

export default Login;
