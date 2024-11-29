import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import GamePage from './components/GamePage';
import LeaderboardPage from './components/LeaderboardPage';
import FriendsPage from './components/FriendsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/friends" element={<FriendsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
