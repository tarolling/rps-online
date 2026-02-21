"use client";

import { getDatabase, onValue, push, ref, set } from 'firebase/database';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from './TournamentsPage.module.css';
import { Tournament } from '@/types/tournament';
import { postJSON } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type NewTournamentForm = {
    name: string;
    playerCap: number;
    description: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

const TournamentsPage = () => {
    const { user } = useAuth();
    const db = getDatabase();

    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [form, setForm] = useState<NewTournamentForm>({ name: '', playerCap: 8, description: '' });
    const [error, setError] = useState<string | null>(null);

    // Subscribe to all tournaments
    useEffect(() => {
        const unsubscribe = onValue(ref(db, 'tournaments'), (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            setTournaments(
                Object.entries(data).map(([id, t]) => ({ id, ...(t as Omit<Tournament, 'id'>) }))
            );
        });
        return () => unsubscribe();
    }, []);

    // Check admin claim from Firebase token
    useEffect(() => {
        if (!user) return;
        postJSON('/api/admin/isAdmin', { uid: user.uid })
            .then(({ isAdmin }) => setIsAdmin(isAdmin));
    }, [user]);

    const handleCreate = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!isAdmin || !user) return;
        setError(null);

        try {
            const newRef = push(ref(db, 'tournaments'));
            await set(newRef, {
                id: crypto.randomUUID(),
                name: form.name,
                description: form.description,
                playerCap: Number(form.playerCap),
                status: 'registration',
                createdAt: Date.now(),
                createdBy: user.uid,
                participants: {},
            });
            setForm({ name: '', playerCap: 8, description: '' });
        } catch (err) {
            console.error('Error creating tournament:', err);
            setError('Failed to create tournament. Please try again.');
        }
    };

    const getStatusLabel = (t: Tournament): string => {
        if (t.status === 'completed') return 'Completed';
        if (t.status === 'in_progress') return 'In Progress';
        const count = Object.keys(t.participants ?? {}).length;
        if (count >= t.playerCap) return 'Full';
        return `${count}/${t.playerCap} Players`;
    };

    const active = tournaments.filter((t) => t.status !== 'completed').sort((a, b) => b.createdAt - a.createdAt);
    const past = tournaments.filter((t) => t.status === 'completed').sort((a, b) => b.createdAt - a.createdAt);

    return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                <h1>Tournaments</h1>

                {error && <p className={styles.errorBanner}>{error}</p>}

                {/* Admin: create tournament */}
                {isAdmin && (
                    <section className={styles.card}>
                        <h2>Create Tournament</h2>
                        <form onSubmit={handleCreate} className={styles.form} noValidate>
                            <div className={styles.field}>
                                <label className={styles.label} htmlFor="t-name">Name</label>
                                <input
                                    id="t-name"
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Tournament name"
                                    required
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label} htmlFor="t-cap">Player Cap</label>
                                <select
                                    id="t-cap"
                                    className={styles.select}
                                    value={form.playerCap}
                                    onChange={(e) => setForm({ ...form, playerCap: Number(e.target.value) })}
                                >
                                    {[4, 8, 16, 32, 64].map((n) => (
                                        <option key={n} value={n}>{n} Players</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label} htmlFor="t-desc">Description</label>
                                <textarea
                                    id="t-desc"
                                    className={styles.textarea}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Brief description"
                                    required
                                />
                            </div>
                            <button type="submit" className={styles.createButton}>
                                Create Tournament
                            </button>
                        </form>
                    </section>
                )}

                {/* Active tournaments */}
                <section>
                    <h2 className={styles.sectionTitle}>Active Tournaments</h2>
                    {active.length === 0 ? (
                        <p className={styles.empty}>No active tournaments right now.</p>
                    ) : (
                        <div className={styles.grid}>
                            {active.map((t) => (
                                <TournamentCard
                                    key={t.id}
                                    tournament={t}
                                    statusLabel={getStatusLabel(t)}
                                    linkLabel="View Tournament"
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* Past tournaments */}
                {past.length > 0 && (
                    <section>
                        <h2 className={styles.sectionTitle}>Past Tournaments</h2>
                        <div className={styles.grid}>
                            {past.map((t) => (
                                <TournamentCard
                                    key={t.id}
                                    tournament={t}
                                    statusLabel={`Winner: ${t.winner?.username ?? 'Unknown'}`}
                                    linkLabel="View Results"
                                    completed
                                />
                            ))}
                        </div>
                    </section>
                )}
            </main>
            <Footer />
        </div>
    );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TournamentCard({ tournament, statusLabel, linkLabel, completed = false }: {
    tournament: Tournament;
    statusLabel: string;
    linkLabel: string;
    completed?: boolean;
}) {
    return (
        <div className={`${styles.tournamentCard} ${completed ? styles.completed : ''}`}>
            <h3>{tournament.name}</h3>
            {tournament.description && (
                <p className={styles.cardDescription}>{tournament.description}</p>
            )}
            <p className={styles.cardStatus}>{statusLabel}</p>
            <Link href={`/tournament/${tournament.id}`} className={styles.viewButton}>
                {linkLabel}
            </Link>
        </div>
    );
}

export default TournamentsPage;