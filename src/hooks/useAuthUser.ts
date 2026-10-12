"use client";

import { useState, useEffect } from "react";

interface SimpleUser {
    id: string;
    username: string;
    email?: string;
}

export function useAuthUser() {
    const [user, setUser] = useState<SimpleUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                } else {
                    setUser(null);
                }
            } catch (e) {
                console.error("Auth check failed", e);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, []);

    return {
        user,
        userId: user?.id ?? null,
        loading,
        isAuthenticated: !!user
    };
}
