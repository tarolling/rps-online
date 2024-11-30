import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../api/supabase';
import '../index.css'


function LoginPage() {
    const navigate = useNavigate();
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState({
        general: null,
        username: null,
        email: null,
        password: null,
        confirmPassword: null,
    });
    const [success, setSuccess] = useState(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: null, general: null }));
        setSuccess(null);
    };

    const validateRegistration = async () => {
        const { username, email, password, confirmPassword } = formData;
        const newErrors = {};

        if (isRegistering && username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters.';
        } else if (isRegistering) {
            try {
                const usernameData = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('username', username)
                    .limit(1);
                if (usernameData) {
                    newErrors.username = 'Username is already taken.';
                }
            } catch (err) {
                console.error(err);
                newErrors.username = 'Username is already taken.';
            }
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            newErrors.email = 'Invalid email address.';
        }

        if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters.';
        }

        if (isRegistering && password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match.';
        }

        return newErrors;
    };

    const handleRegister = async () => {
        const validationErrors = validateRegistration();
        if (Object.keys(validationErrors).length > 0) {
            console.log(`what be the errors: ${Object.values(validationErrors)}`)
            setErrors(validationErrors);
            return;
        }

        try {
            const { error, user } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: { username: formData.username },
                },
            });
            if (error) throw error;

            await supabase.from('profiles').insert({
                id: user.id,
                username: formData.username,
            });

            setSuccess('Registration successful!');
            setIsRegistering(false);
        } catch (err) {
            setErrors({ general: err.message });
        }
    };

    const handleLogin = async () => {
        try {
            const { data: { user }, error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });

            if (error) throw error;

            const response = await fetch('/api/initPlayer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, username: user.user_metadata.username }),
            });

            if (response.status !== 200) {
                throw new Error("Something went wrong...");
            }
            navigate('/home');
        } catch (err) {
            setErrors({ general: 'Invalid email or password.' });
        }
    };

    // const handleDiscordLogin = async () => {
    //     try {
    //         const { data, error } = await supabase.auth.signInWithOAuth({
    //             provider: 'discord',
    //             options: {
    //                 redirectTo: "/home"
    //             }
    //         })
    //     } catch (err) {
    //         console.error(err);
    //     }
    // };

    return (
        <div style={{ maxWidth: '400px', margin: 'auto', padding: '20px' }}>
            <h2>{isRegistering ? 'Register' : 'Login'}</h2>
            {success && (
                <p className="success-message">
                    {success}
                </p>
            )}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    isRegistering ? handleRegister() : handleLogin();
                }}
            >
                {isRegistering && (
                    <div>
                        <label>Username</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            required
                        />
                        {errors.username && (
                            <p className="error-message">{errors.username}</p>
                        )}
                    </div>
                )}
                <div>
                    <label>Email</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                    />
                    {errors.email && (
                        <p className="error-message">{errors.email}</p>
                    )}
                </div>
                <div>
                    <label>Password</label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                    />
                    {errors.password && (
                        <p className="error-message">{errors.password}</p>
                    )}
                </div>
                {isRegistering && (
                    <div>
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            required
                        />
                        {errors.confirmPassword && (
                            <p className="error-message">{errors.confirmPassword}</p>
                        )}
                    </div>
                )}
                {errors.general && (
                    <p className="error-message">{errors.general}</p>
                )}
                <button type="submit">{isRegistering ? 'Register' : 'Login'}</button>
            </form>
            <button onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? 'Switch to Login' : 'Switch to Register'}
            </button>
            {/* <button onClick={handleDiscordLogin}>Login with Discord</button> */}
        </div>
    );
}

export default LoginPage;
