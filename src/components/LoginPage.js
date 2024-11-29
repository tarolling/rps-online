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
    const navigate = useNavigate();
    const [session, setSession] = useState(null)

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setSession(user);
            }
        };
        fetchUser();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, _session) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setSession(user);
                await fetch('/api/initPlayer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userId: user.id, email: user.email }),
                });
            }
        });

        return () => subscription.unsubscribe()
    }, [])

    if (!session) {
        return (<Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="dark"
            providers={['discord']}
        />)
    }
    else {
        return (<Dashboard onNavigate={navigate} />)
    }
}

export default LoginPage;
