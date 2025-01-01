import { getDatabase, onValue, push, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../Auth';
import '../styles/TournamentPage.css';
import Footer from './Footer';
import Header from './Header';

const ADMIN_USER_ID = 'TSrV38YAcgXZcL1LPxpnes95pnl1';

const TournamentsPage = () => {
    const { user } = useAuth();
    const [tournaments, setTournaments] = useState([]);
    const [newTournament, setNewTournament] = useState({
        name: '',
        playerCap: 8,
        description: ''
    });
    const db = getDatabase();

    useEffect(() => {
        const tournamentsRef = ref(db, 'tournaments');
        const unsubscribe = onValue(tournamentsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const tournamentList = Object.entries(data).map(([id, tournament]) => ({
                    id,
                    ...tournament
                }));
                setTournaments(tournamentList);
            }
        });

        return () => unsubscribe();
    }, []);

    const createTournament = async (e) => {
        e.preventDefault();
        if (user?.uid !== ADMIN_USER_ID) return;

        const tournamentsRef = ref(db, 'tournaments');
        const newTournamentRef = push(tournamentsRef);

        try {
            await set(newTournamentRef, {
                name: newTournament.name,
                description: newTournament.description,
                playerCap: parseInt(newTournament.playerCap),
                status: 'registration',
                createdAt: Date.now(),
                createdBy: user.uid,
                participants: {}
            });
        } catch (error) {
            console.error("An error occurred:", error);
        }


        setNewTournament({
            name: '',
            playerCap: 8,
            description: ''
        });
    };

    const getTournamentStatus = (tournament) => {
        const participantCount = tournament.participants ? Object.keys(tournament.participants).length : 0;
        const isFull = participantCount >= tournament.playerCap;

        if (tournament.status === 'completed') return 'Completed';
        if (tournament.status === 'in_progress') return 'In Progress';
        if (isFull) return 'Full';
        return `${participantCount}/${tournament.playerCap} Players`;
    };

    return (
        <div>
            <Header />
            <div className="tournaments-page">
                <h1>Tournaments</h1>

                {user?.uid === ADMIN_USER_ID && (
                    <div className="create-tournament-section">
                        <h2>Create New Tournament</h2>
                        <form onSubmit={createTournament} className="create-tournament-form">
                            <div className="form-group">
                                <label>Tournament Name:</label>
                                <input
                                    type="text"
                                    value={newTournament.name}
                                    onChange={(e) => setNewTournament({
                                        ...newTournament,
                                        name: e.target.value
                                    })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Player Cap:</label>
                                <select
                                    value={newTournament.playerCap}
                                    onChange={(e) => setNewTournament({
                                        ...newTournament,
                                        playerCap: e.target.value
                                    })}
                                >
                                    {[4, 8, 16, 32, 64].map(num => (
                                        <option key={num} value={num}>{num} Players</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Description:</label>
                                <textarea
                                    value={newTournament.description}
                                    onChange={(e) => setNewTournament({
                                        ...newTournament,
                                        description: e.target.value
                                    })}
                                    required
                                />
                            </div>
                            <button type="submit" className="create-btn">Create Tournament</button>
                        </form>
                    </div>
                )}

                <div className="tournaments-list">
                    <h2>Active Tournaments</h2>
                    <div className="tournaments-grid">
                        {tournaments
                            .filter(t => t.status !== 'completed')
                            .sort((a, b) => b.createdAt - a.createdAt)
                            .map(tournament => (
                                <div key={tournament.id} className="tournament-card">
                                    <h3>{tournament.name}</h3>
                                    <p className="description">{tournament.description}</p>
                                    <p className="status">{getTournamentStatus(tournament)}</p>
                                    <Link to={`/tournament/${tournament.id}`} className="view-btn">
                                        View Tournament
                                    </Link>
                                </div>
                            ))}
                    </div>

                    <h2>Past Tournaments</h2>
                    <div className="tournaments-grid">
                        {tournaments
                            .filter(t => t.status === 'completed')
                            .sort((a, b) => b.createdAt - a.createdAt)
                            .map(tournament => (
                                <div key={tournament.id} className="tournament-card completed">
                                    <h3>{tournament.name}</h3>
                                    <p className="description">{tournament.description}</p>
                                    <p className="winner">
                                        Winner: {tournament.winner?.username || 'Unknown'}
                                    </p>
                                    <Link to={`/tournament/${tournament.id}`} className="view-btn">
                                        View Results
                                    </Link>
                                </div>
                            ))}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default TournamentsPage;