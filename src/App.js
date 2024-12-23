import React from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router';
import './App.css';
import { AuthProvider, ProtectedRoute } from './Auth';
import DashboardPage from './components/DashboardPage';
import FriendsPage from './components/FriendsPage';
import GamePage from './components/GamePage';
import LeaderboardPage from './components/LeaderboardPage';
import LoginPage from './components/LoginPage';
import MatchmakingPage from './components/MatchmakingPage';
import RegisterPage from './components/RegisterPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/play"
            element={
              <ProtectedRoute>
                <MatchmakingPage />
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
          <Route path="/play" element={<ProtectedRoute><MatchmakingPage /></ProtectedRoute>} />
          <Route path="/game/:gameId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
