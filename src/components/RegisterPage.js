import React, { useState } from 'react';
import Logo from './Logo';
import { useNavigate } from 'react-router';

function RegisterPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleRegister = () => {
        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        // mock registration logic (replace with backend call)
        console.log(`user registered: ${email}`);
        alert('Registration successful! Please login.');
        navigate('/login');
    };

    return (
        <div className="container">
            <div className="card">
                <Logo />
                <h2>Register</h2>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button onClick={handleRegister}>Register</button>
                <button onClick={() => navigate('/login')} style={{ marginTop: '10px' }}>
                    Back to Login
                </button>
            </div>
        </div>
    );
}

export default RegisterPage;
