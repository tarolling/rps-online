import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router';
import LoginPage from './components/LoginPage';
import HomePage from './components/HomePage';
import GamePage from './components/GamePage';
import LeaderboardPage from './components/LeaderboardPage';
import FriendsPage from './components/FriendsPage';
import RegisterPage from './components/RegisterPage';
import ProtectedRoute from './ProtectedRoute';

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
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/game"
          element={
            <ProtectedRoute>
              <GamePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <FriendsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
