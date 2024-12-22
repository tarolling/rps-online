import { useAuthState } from "react-firebase-hooks/auth";
import { useNavigate } from "react-router";
import { auth } from "./api/firebase";

function ProtectedRoute({ children }) {
    const [user] = useAuthState(auth);
    const navigate = useNavigate();

    if (!user) {
        navigate("/login");
    }

    return children;
}

export default ProtectedRoute;
