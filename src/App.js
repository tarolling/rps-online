import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import GamePage from './components/GamePage';
import LeaderboardPage from './components/LeaderboardPage';
import FriendsPage from './components/FriendsPage';
import RegisterPage from './components/RegisterPage';

function App() {
  return (
    <Router>
      <nav>
        <Link to="/register">Register</Link> | <Link to="/login">Login</Link>
      </nav>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/friends" element={<FriendsPage />} />
      </Routes>
    </Router>
  );
}

export default App;
