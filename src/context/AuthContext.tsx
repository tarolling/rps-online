"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getAvatarUrl } from "@/lib/avatar";
import { postJSON } from "@/lib/api";
import { guestUsername } from "@/lib/guestAuth";


interface AuthContextType {
    user: User | null;
    loading: boolean;
    username: string | null;
    avatarUrl: string | null;
    setAvatarUrl: (url: string | null) => void;
    isPremium: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, username: null, avatarUrl: null, setAvatarUrl: () => { }, isPremium: false });

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        if (user.isAnonymous) {
          // Guests have no Neo4j Player row and no Firestore avatar to fetch.
          setUsername(guestUsername(user.uid));
          setIsPremium(false);
          setAvatarUrl(null);
        } else {
          getAvatarUrl(user.uid).then(setAvatarUrl);
          postJSON<{ username: string; isPremium: boolean }>("/api/fetchPlayer", { uid: user.uid })
            .then((d) => { setUsername(d.username); setIsPremium(d.isPremium); })
            .catch(() => { });
        }
      } else {
        setAvatarUrl(null);
        setUsername(null);
        setIsPremium(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, username, avatarUrl, setAvatarUrl, isPremium }}>
      {children}
    </AuthContext.Provider>
  );
};