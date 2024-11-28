import React, { useState } from 'react';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import GamePage from './components/GamePage';
// import FriendsPage from './components/FriendsPage';
// import LeaderboardPage from './components/LeaderboardPage';

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('login');

  const handleLogin = (email) => {
    setUser({ email }); // Mock user
    setPage('dashboard');
  };

  const renderPage = () => {
    if (!user) return <LoginPage onLogin={handleLogin} />;
    switch (page) {
      case 'dashboard':
        return <Dashboard onNavigate={setPage} />;
      case 'game':
        return <GamePage />;
      // case 'leaderboard':
      //   return <LeaderboardPage />;
      // case 'friends':
      //   return <FriendsPage />;
      default:
        return <Dashboard onNavigate={setPage} />;
    }
  };

  return <div>{renderPage()}</div>;
}

export default App;
