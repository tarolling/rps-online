import { getDatabase, onValue, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../Auth';
import '../styles/TournamentPage.css';
import { advanceWinner, startTournament } from '../utils/tournaments';
import Footer from './Footer';
import Header from './Header';

const ADMIN_USER_ID = 'TSrV38YAcgXZcL1LPxpnes95pnl1';


const TournamentPage = () => {
    const { tournamentID } = useParams();
    const { user } = useAuth();
    const [tournament, setTournament] = useState(null);
    const [userRegistered, setUserRegistered] = useState(false);
    const db = getDatabase();

    useEffect(() => {
        const tournamentRef = ref(db, `tournaments/${tournamentID}`);
        const unsubscribe = onValue(tournamentRef, (snapshot) => {
            const tournamentData = snapshot.val();
            if (tournamentData) {
                setTournament(tournamentData);
                setUserRegistered(!!tournamentData.participants?.[user?.uid]);
            }
        });

        return () => unsubscribe();
    }, [tournamentID, user]);

    const handleStartTournament = async () => {
        if (!tournament || tournament.status !== 'registration') return;

        try {
            await startTournament(tournamentID);
        } catch (error) {
            console.error('Error starting tournament:', error);
            alert('Failed to start tournament');
        }
    };

    const registerForTournament = async () => {
        if (!tournament || !user) return;

        const participantCount = tournament.participants ? Object.keys(tournament.participants).length : 0;
        if (participantCount >= tournament.playerCap) {
            alert('Tournament is full!');
            return;
        }

        const response = await fetch('/api/fetchPlayer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uid: user.uid })
        });

        if (!response.ok) {
            throw new Error("Unable to fetch player in database.");
        }
        const userData = await response.json();

        await set(ref(db, `tournaments/${tournamentID}/participants/${user.uid}`), {
            id: user.uid,
            username: userData.username,
            rating: userData.rating,
            registered: Date.now()
        });
    };

    const getUserNextMatch = () => {
        if (!tournament?.bracket || !user) return null;

        return tournament.bracket.find(match =>
            (match.player1?.id === user.uid || match.player2?.id === user.uid) &&
            match.status === 'pending'
        );
    };

    const renderMatchCard = (match) => {
        if (!match) return null;

        const gameID = tournament.matchGames?.[match.matchId];
        const isPlayer1 = match.player1?.id === user?.uid;
        const opponent = isPlayer1 ? match.player2 : match.player1;

        return (
            <div className="match-card">
                <h3>Your Match</h3>
                <div className="players">
                    <div className={`player ${isPlayer1 ? 'you' : ''}`}>
                        {match.player1?.username}
                        {isPlayer1 && ' (You)'}
                    </div>
                    <div className="vs">vs</div>
                    <div className={`player ${!isPlayer1 ? 'you' : ''}`}>
                        {match.player2?.username}
                        {!isPlayer1 && ' (You)'}
                    </div>
                </div>
                {gameID && (
                    <Link
                        to={`/game/${gameID}`}
                        className="play-btn"
                    >
                        Play Match
                    </Link>
                )}
            </div>
        );
    };

    const renderBracket = () => {
        if (!tournament?.bracket) return null;

        // Group matches by round
        const rounds = {};
        tournament.bracket.forEach(match => {
            if (!rounds[match.round]) rounds[match.round] = [];
            rounds[match.round].push(match);
        });

        console.log('rounds:', JSON.stringify(rounds));

        return (
            <div className="bracket">
                {Object.entries(rounds).map(([round, matches]) => (
                    <div key={round} className="round">
                        <div className="round-header">Round {round}</div>
                        <div className="matches">
                            {matches.map((match) => (
                                <div key={match.matchID} className={`match ${match.status}`}>
                                    <div className={`player ${match.winner?.id === match.player1?.id ? 'winner' : ''}`}>
                                        <span className="seed">{match.player1?.seed || '?'}</span>
                                        <span className="name">{match.player1?.username || 'TBD'}</span>
                                    </div>
                                    <div className={`player ${match.winner?.id === match.player2?.id ? 'winner' : ''}`}>
                                        <span className="seed">{match.status === 'bye' ? 'X' : (match.player2?.seed || '?')}</span>
                                        <span className="name">{match.status === 'bye' ? 'BYE' : (match.player2?.username || 'TBD')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (!tournament) {
        return <div>Loading...</div>;
    }

    const participantCount = tournament.participants ? Object.keys(tournament.participants).length : 0;
    const isFull = participantCount >= tournament.playerCap;

    return (
        <div>
            <Header />
            <div className="tournament-page">
                <div className="tournament-header">
                    <Link to="/tournaments" className="back-btn">← Back to Tournaments</Link>
                    <h1>{tournament.name}</h1>
                    <p className="description">{tournament.description}</p>
                </div>

                {user?.uid === ADMIN_USER_ID && tournament?.status === 'registration' && (
                    <div className="admin-controls">
                        <h2>Admin Controls</h2>
                        <button
                            className="start-btn"
                            onClick={handleStartTournament}
                            disabled={!tournament.participants ||
                                Object.keys(tournament.participants).length < 2}
                        >
                            Start Tournament
                        </button>
                        <p className="min-players">
                            {(!tournament.participants ||
                                Object.keys(tournament.participants).length < 2) &&
                                'At least 2 players required to start'}
                        </p>
                    </div>
                )}

                {tournament.status === 'registration' && (
                    <div className="registration-section">
                        <h2>Registration {isFull ? 'Full' : 'Open'}</h2>
                        <p>Players registered: {participantCount}/{tournament.playerCap}</p>
                        {!userRegistered ? (
                            <button
                                className="register-btn"
                                onClick={registerForTournament}
                                disabled={isFull}
                            >
                                {isFull ? 'Tournament Full' : 'Register'}
                            </button>
                        ) : (
                            <p className="registered-msg">You are registered!</p>
                        )}

                        <div className="participants-list">
                            <h3>Registered Players</h3>
                            <div className="participants-grid">
                                {tournament.participants && Object.values(tournament.participants)
                                    .sort((a, b) => b.rating - a.rating)
                                    .map(participant => (
                                        <div key={participant.id} className="participant-card">
                                            <span className="name">{participant.username}</span>
                                            <span className="rating">Rating: {participant.rating}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                {tournament.status === 'in_progress' && (
                    <>
                        <div className="tournament-status">
                            <h2>Tournament in Progress</h2>
                            {renderBracket()}
                        </div>

                        {userRegistered && (
                            <div className="your-matches">
                                <h2>Your Next Match</h2>
                                {renderMatchCard(getUserNextMatch()) || (
                                    <p className="no-matches">No upcoming matches</p>
                                )}
                            </div>
                        )}
                    </>
                )}

                {tournament.status === 'completed' && (
                    <div className="tournament-complete">
                        <h2>Tournament Complete!</h2>
                        <div className="winner-display">
                            <h3>Winner</h3>
                            <p>{tournament.winner?.username}</p>
                        </div>
                        {renderBracket()}
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default TournamentPage;