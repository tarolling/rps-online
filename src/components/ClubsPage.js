import React, { useEffect, useState } from 'react';
import { useAuth } from '../Auth';
import Footer from './Footer';
import Header from './Header';

const ClubsPage = () => {
    const { user } = useAuth();
    const [clubs, setClubs] = useState([]);
    const [userClub, setUserClub] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createClubData, setCreateClubData] = useState({
        name: '',
        tag: '',
        availability: 'open'
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchClubs();
        fetchUserClub();
    }, [user]);

    const fetchClubs = async () => {
        setClubs([]);

        try {
            const response = await fetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ methodType: 'search', searchTerm })
            });
            const data = await response.json();
            setClubs(data.clubs);
        } catch (err) {
            setError('Failed to fetch clubs');
        } finally {
            setLoading(false);
        }
    };

    const fetchUserClub = async () => {
        setUserClub(null);

        try {
            const response = await fetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ methodType: 'user', uid: user.uid })
            });
            const data = await response.json();
            setUserClub(data);
        } catch (err) {
            setError('Failed to fetch user clubs');
        }
    };

    const handleJoinClub = async (clubName) => {
        try {
            await fetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ methodType: 'join', uid: user.uid, clubName })
            });
            await fetchUserClub();
            await fetchClubs();
        } catch (err) {
            setError('Failed to join club');
        }
    };

    const handleLeaveClub = async (clubName) => {
        try {
            await fetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ methodType: 'leave', uid: user.uid, clubName })
            });
            await fetchUserClub();
            await fetchClubs();
        } catch (err) {
            setError('Failed to leave club');
        }
    };

    const handleCreateClub = async (e) => {
        e.preventDefault();
        try {
            await fetch('/api/clubs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...createClubData,
                    methodType: 'create',
                    founderID: user.uid
                })
            });
            setShowCreateModal(false);
            await fetchClubs();
            await fetchUserClub();
        } catch (err) {
            setError('Failed to create club');
        }
    };

    return (
        <div className="dashboard">
            <Header />
            <div className="dashboard-container">
                <section className="welcome-section">
                    <h1>Clubs</h1>
                    <button
                        className="play-button"
                        onClick={() => setShowCreateModal(true)}
                    >
                        Create New Club
                    </button>
                </section>
                <div className="dashboard-grid">
                    <section className="stats-card">
                        <h2>My Club</h2>
                        <div className="matches-list">
                            {userClub ? (<div className="match-item">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="match-opponent">{userClub.name}</span>
                                        <span className="text-sm text-gray-500 ml-2">[{userClub.tag}]</span>
                                    </div>
                                    <span className="text-sm font-medium text-blue-600">
                                        {userClub.memberRole}
                                    </span>
                                </div>
                                <div className="match-details">
                                    <span>{userClub.memberCount}/50 members</span>
                                    {userClub.memberRole !== 'Founder' && (
                                        <button
                                            onClick={() => handleLeaveClub(userClub.name)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            Leave
                                        </button>
                                    )}
                                </div>
                            </div>
                            ) : (
                                <p className="text-gray-500 text-center py-4">
                                    You haven&apos;t joined any clubs yet
                                </p>
                            )}
                        </div>
                    </section>
                    <section className="stats-card">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder="Search clubs..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && fetchClubs()}
                                />
                            </div>
                            <button
                                onClick={fetchClubs}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Search
                            </button>
                        </div>
                        <div className="matches-list">
                            {clubs.map((club, index) => (
                                <div key={index} className="match-item">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="match-opponent">{club.name}</span>
                                            <span className="text-sm text-gray-500 ml-2">[{club.tag}]</span>
                                        </div>
                                        <span className="text-sm capitalize text-gray-600">
                                            {club.availability}
                                        </span>
                                    </div>
                                    <div className="match-details">
                                        <span>{club.memberCount}/50 members</span>
                                        {club.availability === 'open' && !userClub && (
                                            <button
                                                onClick={() => handleJoinClub(club.name)}
                                                className="text-blue-500 hover:text-blue-700"
                                            >
                                                Join
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full">
                            <h2 className="text-xl font-bold mb-4">Create New Club</h2>
                            <form onSubmit={handleCreateClub}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Club Name
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded-lg"
                                        value={createClubData.name}
                                        onChange={(e) => setCreateClubData(prev => ({
                                            ...prev,
                                            name: e.target.value.trim()
                                        }))}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Club Tag
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded-lg"
                                        value={createClubData.tag}
                                        onChange={(e) => setCreateClubData(prev => ({
                                            ...prev,
                                            tag: e.target.value.trim().toUpperCase()
                                        }))}
                                        maxLength={4}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Availability
                                    </label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={createClubData.availability}
                                        onChange={(e) => setCreateClubData(prev => ({
                                            ...prev,
                                            availability: e.target.value
                                        }))}
                                    >
                                        <option value="open">Open</option>
                                        <option value="invite">Invite Only</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                    >
                                        Create Club
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="fixed bottom-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
                        {error}
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default ClubsPage;