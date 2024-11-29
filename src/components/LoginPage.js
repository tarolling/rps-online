import React, { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import Dashboard from './Dashboard';
import { useNavigate } from 'react-router';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function LoginPage() {
    const [res, setRes] = useState(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await fetch('/api/initPlayer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ id: '1' }),
                });

                const data = response.status
                setRes(data);
            } catch (error) {
                console.error('Error calling vercel function:', error);
            }
        };
        fetchUser();
    }, []);


    return (
        <div>
            <h1>anybody home?</h1>
            <p>{res ? `returned code ${JSON.stringify(res)}` : 'Loading...'}</p>
        </div>
    );


    // const navigate = useNavigate();
    // const [session, setSession] = useState(null)

    // useEffect(() => {
    //     const fetchUser = async () => {
    //         const { data: { user } } = await supabase.auth.getUser();
    //         if (user) {
    //             setSession(user);
    //         }
    //     };
    //     fetchUser();

    //     const {
    //         data: { subscription },
    //     } = supabase.auth.onAuthStateChange(async (_event, _session) => {
    //         const { data: { user } } = await supabase.auth.getUser();
    //         if (user) {
    //             setSession(user);
    //             await fetch('/api/initPlayer', {
    //                 method: 'POST',
    //                 headers: {
    //                     'Content-Type': 'application/json',
    //                 },
    //                 body: JSON.stringify({ userId: user.id, email: user.email }),
    //             });
    //         }
    //     });

    //     return () => subscription.unsubscribe()
    // }, [])

    // return (
    //     <div className="container" style={{ padding: '50px 0 100px 0' }}>
    //         {!session ? <Auth
    //             supabaseClient={supabase}
    //             appearance={{ theme: ThemeSupa }}
    //             theme="dark"
    //             providers={['discord']}
    //             redirectTo={process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://ranked-rps.vercel.app/'}
    //         /> : <Dashboard session={session} onNavigate={navigate} />}
    //     </div>
    // )
}

export default LoginPage;
