"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { postJSON } from '@/lib/api';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from './ClubsPage.module.css';
import { Club, ClubAvailability, UserClub } from '@/types/club';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type CreateClubForm = {
    name: string;
    tag: string;
    availability: ClubAvailability;
};

// ── Component ─────────────────────────────────────────────────────────────────

const ClubsPage = () => {
    const { user } = useAuth();

    const [clubs, setClubs] = useState<Club[]>([]);
    const [userClub, setUserClub] = useState<UserClub | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState<CreateClubForm>({ name: '', tag: '', availability: 'Open' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchClubs();
        fetchUserClub();
    }, [user?.uid]);

    const fetchClubs = async () => {
        setClubs([]);
        try {
            const data = await postJSON<{ clubs: Club[] }>('/api/clubs', { methodType: 'search', searchTerm });
            setClubs(data.clubs ?? []);
        } catch {
            setError('Failed to fetch clubs.');
        } finally {
            setLoading(false);
        }
    };

    const fetchUserClub = async () => {
        if (!user) return;
        setUserClub(null);
        try {
            const data = await postJSON<UserClub & { error?: string }>('/api/clubs', { methodType: 'user', uid: user.uid });
            if (!data.error) setUserClub(data);
        } catch {
            // User is not in a club — not an error worth surfacing
        }
    };

    const handleJoinClub = async (clubName: string) => {
        if (!user) return;
        setError(null);
        try {
            await postJSON('/api/clubs', { methodType: 'join', uid: user.uid, clubName });
            await Promise.all([fetchUserClub(), fetchClubs()]);
        } catch {
            setError('Failed to join club. Try refreshing.');
        }
    };

    const handleLeaveClub = async (clubName: string) => {
        if (!user) return;
        setError(null);
        try {
            await postJSON('/api/clubs', { methodType: 'leave', uid: user.uid, clubName });
            await Promise.all([fetchUserClub(), fetchClubs()]);
        } catch {
            setError('Failed to leave club.');
        }
    };

    const handleCreateClub = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!user) return;
        if (userClub) {
            setError('You are already in a club.');
            return;
        }
        setError(null);
        try {
            await postJSON('/api/clubs', { ...createForm, methodType: 'create', founderID: user.uid });
            setShowCreateModal(false);
            setCreateForm({ name: '', tag: '', availability: 'Open' });
            await Promise.all([fetchClubs(), fetchUserClub()]);
        } catch {
            setError('Failed to create club.');
        }
    };

    return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                <div className={styles.pageHeader}>
                    <h1>Clubs</h1>
                    <button className={styles.createButton} onClick={() => setShowCreateModal(true)}>
                        Create Club
                    </button>
                </div>

                {error && <p className={styles.errorBanner} onClick={() => setError(null)}>{error} ×</p>}

                <div className={styles.grid}>
                    {/* My Club */}
                    <section className={styles.card}>
                        <h2>My Club</h2>
                        {userClub ? (
                            <div className={styles.userClub}>
                                <div className={styles.clubRow}>
                                    <Link href={`/clubs/${encodeURIComponent(userClub.name)}`} className={styles.clubName}>
                                        {userClub.name}
                                    </Link>
                                    <span className={styles.clubTag}>[{userClub.tag}]</span>
                                    <span className={styles.clubRole}>{userClub.memberRole}</span>
                                </div>
                                <div className={styles.clubMeta}>
                                    <span className={styles.memberCount}>{userClub.memberCount}/50 members</span>
                                    {userClub.memberRole !== 'Founder' && (
                                        <button
                                            className={styles.leaveButton}
                                            onClick={() => handleLeaveClub(userClub.name)}
                                        >
                                            Leave
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className={styles.emptyState}>You haven't joined any clubs yet.</p>
                        )}
                    </section>

                    {/* Search */}
                    <section className={styles.card}>
                        <h2>Find a Club</h2>
                        <div className={styles.searchRow}>
                            <input
                                type="text"
                                placeholder="Search clubs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchClubs()}
                            />
                            <button className={styles.searchButton} onClick={fetchClubs}>
                                Search
                            </button>
                        </div>

                        {loading ? (
                            <p className={styles.emptyState}>Loading…</p>
                        ) : clubs.length === 0 ? (
                            <p className={styles.emptyState}>No clubs found.</p>
                        ) : (
                            <div className={styles.clubList}>
                                {clubs.map((club) => (
                                    <div key={club.name} className={styles.clubItem}>
                                        <div className={styles.clubRow}>
                                            <Link href={`/clubs/${encodeURIComponent(club.name)}`} className={styles.clubName}>
                                                {club.name}
                                            </Link>
                                            <span className={styles.clubTag}>[{club.tag}]</span>
                                            <span className={styles.clubAvailability}>{club.availability}</span>
                                        </div>
                                        <div className={styles.clubMeta}>
                                            <span className={styles.memberCount}>{club.memberCount}/50 members</span>
                                            {club.availability === 'Open' && !userClub && (
                                                <button
                                                    className={styles.joinButton}
                                                    onClick={() => handleJoinClub(club.name)}
                                                >
                                                    Join
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>

            {/* Create modal */}
            {showCreateModal && (
                <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2>Create New Club</h2>
                        <form onSubmit={handleCreateClub} className={styles.form} noValidate>
                            <div className={styles.field}>
                                <label className={styles.label} htmlFor="club-name">Club Name</label>
                                <input
                                    id="club-name"
                                    type="text"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value.trim() }))}
                                    required
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label} htmlFor="club-tag">Tag (max 4 chars)</label>
                                <input
                                    id="club-tag"
                                    type="text"
                                    value={createForm.tag}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, tag: e.target.value.trim().toUpperCase() }))}
                                    maxLength={4}
                                    required
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label} htmlFor="club-availability">Availability</label>
                                <select
                                    id="club-availability"
                                    className={styles.select}
                                    value={createForm.availability}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, availability: e.target.value as ClubAvailability }))}
                                >
                                    <option value="Open">Open</option>
                                    <option value="Invite">Invite Only</option>
                                    <option value="Closed">Closed</option>
                                </select>
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelButton} onClick={() => setShowCreateModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles.submitButton}>
                                    Create Club
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default ClubsPage;