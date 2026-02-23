"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { postJSON } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import styles from "./ClubPage.module.css";
import { ClubAvailability } from "@/types/club";

// ── Types ─────────────────────────────────────────────────────────────────────

type ClubMember = {
    uid: string;
    username: string;
    rating: number;
    role: "Member" | "Founder";
};

type ClubDetail = {
    name: string;
    tag: string;
    availability: ClubAvailability;
    members: ClubMember[];
};

type EditForm = {
    newName: string;
    newTag: string;
    availability: ClubAvailability;
};

const RANK_ICON: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };
const AVAILABILITY_OPTIONS: ClubAvailability[] = ["Open", "Invite", "Closed"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClubPage() {
    const { clubName } = useParams<{ clubName: string }>();
    const decodedName = decodeURIComponent(clubName);
    const { user } = useAuth();
    const router = useRouter();

    const [club, setClub] = useState<ClubDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<EditForm>({ newName: "", newTag: "", availability: "Open" });
    const [saving, setSaving] = useState(false);

    const isFounder = club?.members.find((m) => m.uid === user?.uid)?.role === "Founder";

    useEffect(() => {
        fetchClub();
    }, [decodedName]);

    const fetchClub = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await postJSON<ClubDetail>("/api/clubs", {
                methodType: "members",
                clubName: decodedName,
            });
            setClub(data);
            setEditForm({ newName: data.name, newTag: data.tag, availability: data.availability });
        } catch {
            setError("Failed to load club.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!user || !club) return;
        setSaving(true);
        setError(null);
        try {
            await postJSON("/api/clubs", {
                methodType: "update",
                uid: user.uid,
                clubName: club.name,
                newName: editForm.newName,
                newTag: editForm.newTag,
                availability: editForm.availability,
            });
            // If name changed, navigate to new URL
            if (editForm.newName !== club.name) {
                router.replace(`/clubs/${encodeURIComponent(editForm.newName)}`);
            } else {
                await fetchClub();
            }
            setIsEditing(false);
        } catch {
            setError("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveMember = async (targetUid: string) => {
        if (!user || !club) return;
        setError(null);
        try {
            await postJSON("/api/clubs", {
                methodType: "removeMember",
                uid: user.uid,
                clubName: club.name,
                targetUid,
            });
            await fetchClub();
        } catch {
            setError("Failed to remove member.");
        }
    };

    if (loading) return (
        <div className="app"><Header /><main className={styles.main}><p className={styles.status}>Loading…</p></main><Footer /></div>
    );

    if (error && !club) return (
        <div className="app"><Header /><main className={styles.main}><p className={styles.status}>{error}</p></main><Footer /></div>
    );

    if (!club) return null;

    return (
        <div className="app">
            <Header />
            <main className={styles.main}>
                {/* Club Header */}
                <div className={styles.clubHeader}>
                    {isEditing ? (
                        <div className={styles.editForm}>
                            <div className={styles.editRow}>
                                <div className={styles.editField}>
                                    <label>Name</label>
                                    <input
                                        value={editForm.newName}
                                        onChange={(e) => setEditForm((f) => ({ ...f, newName: e.target.value }))}
                                        maxLength={40}
                                    />
                                </div>
                                <div className={styles.editField}>
                                    <label>Tag</label>
                                    <input
                                        value={editForm.newTag}
                                        onChange={(e) => setEditForm((f) => ({ ...f, newTag: e.target.value }))}
                                        maxLength={6}
                                    />
                                </div>
                                <div className={styles.editField}>
                                    <label>Availability</label>
                                    <select
                                        value={editForm.availability}
                                        onChange={(e) => setEditForm((f) => ({ ...f, availability: e.target.value as ClubAvailability }))}
                                    >
                                        {AVAILABILITY_OPTIONS.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className={styles.editActions}>
                                <button className={styles.saveButton} onClick={handleSaveEdit} disabled={saving}>
                                    {saving ? "Saving…" : "Save"}
                                </button>
                                <button className={styles.cancelButton} onClick={() => setIsEditing(false)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.clubInfo}>
                            <div className={styles.clubTitle}>
                                <h1>{club.name}</h1>
                                <span className={styles.tag}>[{club.tag}]</span>
                                <span className={styles.availability}>{club.availability}</span>
                            </div>
                            <p className={styles.memberCount}>{club.members.length}/50 members</p>
                            {isFounder && (
                                <button className={styles.editButton} onClick={() => setIsEditing(true)}>
                                    Edit Club
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {error && <p className={styles.error}>{error}</p>}

                {/* Members Table */}
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.rankCol}>Rank</th>
                                <th>Player</th>
                                <th>Role</th>
                                <th className={styles.ratingCol}>Rating</th>
                                {isFounder && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {club.members.map((member, i) => (
                                <tr key={member.uid} className={styles.row}>
                                    <td className={styles.rank}>
                                        {RANK_ICON[i] ?? i + 1}
                                    </td>
                                    <td className={styles.username}>
                                        <Link href={`/profile/${member.uid}`}>{member.username}</Link>
                                    </td>
                                    <td className={styles.role}>{member.role}</td>
                                    <td className={styles.rating}>{member.rating}</td>
                                    {isFounder && (
                                        <td className={styles.removeCol}>
                                            {member.uid !== user?.uid && (
                                                <button
                                                    className={styles.removeButton}
                                                    onClick={() => handleRemoveMember(member.uid)}
                                                    title="Remove from club"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
            <Footer />
        </div>
    );
}