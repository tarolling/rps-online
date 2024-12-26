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
import RulesPage from './components/RulesPage';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

export default function App() {
  return (
    <div>

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
            <Route path="/game/:gameID" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
            <Route path="/rules" element={<RulesPage />} />
          </Routes>
        </Router>
      </AuthProvider>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}