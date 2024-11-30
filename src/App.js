import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import GamePage from './components/GamePage';
import LeaderboardPage from './components/LeaderboardPage';
import FriendsPage from './components/FriendsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/friends" element={<FriendsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
