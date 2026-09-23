"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { onIdTokenChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getAvatarUrl } from "@/lib/avatar";
import { postJSON, setUnauthorizedHandler } from "@/lib/api";
import { guestUsername } from "@/lib/guestAuth";
import {
  establishSession,
  hasFreshSession,
  isUnauthorizedError,
  signOutEverywhere,
} from "@/lib/session";

export type AuthStatus = "loading" | "authenticated" | "guest" | "unauthenticated";

interface AuthContextType {
    user: User | null;
    /**
     * The authorization source of truth. "authenticated" and "guest" mean
     * BOTH a Firebase identity AND an established server session cookie.
     *
     * Note that `user` can be non-null while `status` is "unauthenticated":
     * Firebase restores an identity from IndexedDB on load, but the server
     * session may be unobtainable (account deleted, disabled, or revoked).
     * Anything making an authorization or "are they logged in" decision must
     * read `status`. Consumers that just need a uid to fetch public data may
     * keep reading `user`.
     */
    status: AuthStatus;
    /** @deprecated Derived from `status`; prefer `status === "loading"`. */
    loading: boolean;
    username: string | null;
    avatarUrl: string | null;
    setAvatarUrl: (url: string | null) => void;
    isPremium: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, status: "loading", loading: true, username: null, avatarUrl: null, setAvatarUrl: () => { }, isPremium: false });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    const hydrateProfile = (nextUser: User) => {
      if (nextUser.isAnonymous) {
        // Guests have no Neo4j Player row and no Firestore avatar to fetch.
        setUsername(guestUsername(nextUser.uid));
        setIsPremium(false);
        setAvatarUrl(null);
        return;
      }
      getAvatarUrl(nextUser.uid).then(setAvatarUrl);
      postJSON<{ username: string; isPremium: boolean }>("/api/fetchPlayer", { uid: nextUser.uid })
        .then((d) => { setUsername(d.username); setIsPremium(d.isPremium); })
        .catch((err) => console.warn("Could not load player profile:", err));
    };

    // onIdTokenChanged, not onAuthStateChanged: it additionally fires on every
    // ~hourly ID token refresh and on load with a restored session, which is
    // what lets the server session slide alongside the client one instead of
    // expiring independently after a fixed 5 days.
    const unsubscribe = onIdTokenChanged(auth, (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setStatus("unauthenticated");
        setUsername(null);
        setAvatarUrl(null);
        setIsPremium(false);
        // Deliberately NOT clearing the server cookie here. A null user means
        // either an explicit sign-out (signOutEverywhere already cleared it)
        // or an account deletion, whose follow-up API call still needs it.
        return;
      }

      hydrateProfile(nextUser);
      const settled: AuthStatus = nextUser.isAnonymous ? "guest" : "authenticated";

      // Fast path: the expiry hint says a healthy cookie already exists, so
      // commit the status synchronously. Not awaiting is what keeps a hard
      // reload from flashing logged-out chrome before it resolves.
      if (hasFreshSession()) {
        setStatus(settled);
        return;
      }

      // Note this can't loop: getIdToken(true) itself fires onIdTokenChanged,
      // but by then the hint cookie is fresh and the fast path above returns.
      void establishSession(nextUser)
        .then(() => setStatus(settled))
        .catch((err) => {
          if (isUnauthorizedError(err)) {
            // The identity itself is dead (deleted, disabled, or revoked).
            // Drop the ghost client session rather than render logged-in
            // chrome we can't back up.
            console.warn("Session could not be established; signing out:", err);
            setStatus("unauthenticated");
            // Full teardown, not a bare signOut: a stale cookie from a
            // previous session may still be sitting there.
            void signOutEverywhere();
            return;
          }
          // Anything else (offline, our own server down) is transient and says
          // nothing about the identity, so don't yank someone's session over
          // it. The 401 retry in api.ts re-mints on the next authed call, and
          // the next token refresh retries too.
          console.error("Could not establish a server session:", err);
          setStatus(settled);
        });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Lets any authenticated fetch recover from a 401 by renewing the session
    // cookie once and replaying itself, instead of failing silently while the
    // UI still looks logged in.
    setUnauthorizedHandler(async () => {
      const current = auth.currentUser;
      if (!current) return false;
      try {
        await establishSession(current, { force: true });
        return true;
      } catch (err) {
        console.warn("Could not refresh the session after a 401:", err);
        setStatus("unauthenticated");
        if (isUnauthorizedError(err)) await signOutEverywhere();
        return false;
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, loading: status === "loading", username, avatarUrl, setAvatarUrl, isPremium }}>
      {children}
    </AuthContext.Provider>
  );
};
