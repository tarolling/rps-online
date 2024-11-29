import React, { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared'
import Dashboard from './Dashboard';
import { useNavigate } from 'react-router';
import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.REACT_APP_DB_AUTH_SUPABASE_URL;
let supabaseAnonKey = process.env.REACT_APP_DB_AUTH_NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) { // annoying check for dev or vercel env
    supabaseUrl = process.env.DB_AUTH_SUPABASE_URL;
    supabaseAnonKey = process.env.DB_AUTH_NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function LoginPage() {
    const navigate = useNavigate();
    const [session, setSession] = useState(null)
    // const [email, setEmail] = useState('');
    // const [password, setPassword] = useState('');


    // const handleLogin = () => {
    //     // mock login logic (replace with backend authentication)
    //     console.log(`user logged in: ${email}`);
    //     navigate('/dashboard');
    // };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    if (!session) {
        return (<Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />)
    }
    else {
        return (<Dashboard onNavigate={navigate} />)
    }

    // return (
    //     <div className="container">
    //         <div className="card">
    //             <Logo />
    //             <h2>Login</h2>
    //             <input
    //                 type="email"
    //                 placeholder="Email"
    //                 value={email}
    //                 onChange={(e) => setEmail(e.target.value)}
    //             />
    //             <input
    //                 type="password"
    //                 placeholder="Password"
    //                 value={password}
    //                 onChange={(e) => setPassword(e.target.value)}
    //             />
    //             <button onClick={handleLogin}>Login</button>
    //             <button onClick={() => navigate('/register')} style={{ marginTop: '10px' }}>
    //                 Register
    //             </button>
    //         </div>
    //     </div>
    // );
}

export default LoginPage;
