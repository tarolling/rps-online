import React from "react";
import { Navigate } from "react-router-dom";
import { auth } from "./firebase";
import { useAuthState } from "react-firebase-hooks/auth";

function ProtectedRoute({ children }) {
    const [user] = useAuthState(auth);

    if (!user) {
        return <Navigate to="/login" />;
    }

    return children;
}

export default ProtectedRoute;
