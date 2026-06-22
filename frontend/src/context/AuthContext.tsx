'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'farmer' | 'shopkeeper';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    avatar?: string;
    profileImage?: string;
}

interface AuthContextType {
    user: User | null;
    role: UserRole | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    requestEmailOtp: (email: string) => Promise<{ delivered?: boolean; devOtp?: string }>;
    verifyEmailOtp: (email: string, otp: string) => Promise<void>;
    login: (email: string, password: string, preferredRole?: UserRole) => Promise<User>;
    register: (userData: RegisterData, preferredRole?: UserRole) => Promise<User>;
    logout: () => void;
}

export interface RegisterData {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    phone?: string;
    companyName?: string;
    shopName?: string;
    businessType?: string;
    location?: string;
    farmSize?: string;
    soilType?: string;
    waterSource?: string;
}

const normalizeRole = (role: unknown): UserRole => {
    return role === 'shopkeeper' || role === 'vendor' ? 'shopkeeper' : 'farmer';
};

const toBackendRole = (role: UserRole) => {
    return role === 'shopkeeper' ? 'vendor' : 'farmer';
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const restoreSession = async () => {
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('authToken');

        if (!savedUser || !savedToken) {
            setUser(null);
            setRole(null);
            setIsLoading(false);
            return;
        }

        // Restore from storage immediately so UI doesn't flash logout
        const parsedUser = JSON.parse(savedUser);
        const normalizedRole = normalizeRole(parsedUser.role);
        const restoredUser = { ...parsedUser, role: normalizedRole };
        setUser(restoredUser);
        setRole(normalizedRole);
        if (normalizedRole !== parsedUser.role) {
            localStorage.setItem('user', JSON.stringify(restoredUser));
        }

        // Validate token in background — only clear if explicitly invalid (401)
        try {
            const res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${savedToken}` },
            });
            if (res.status === 401) {
                // Token is truly invalid — force logout
                localStorage.removeItem('user');
                localStorage.removeItem('authToken');
                setUser(null);
                setRole(null);
            } else if (res.ok) {
                const data = await res.json();
                if (data?.data) {
                    const freshRole = normalizeRole(data.data.role);
                    const freshUser: User = {
                        id: data.data._id || data.data.id,
                        email: data.data.email,
                        name: data.data.name,
                        role: freshRole,
                        phone: data.data.phone,
                        avatar: data.data.avatar,
                        profileImage: data.data.profileImage,
                    };
                    localStorage.setItem('user', JSON.stringify(freshUser));
                    setUser(freshUser);
                    setRole(freshRole);
                }
            }
            // Any other error (network, 5xx) — keep existing session, don't logout
        } catch {
            // Network error — keep existing session intact
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        restoreSession();

        const handleAuthSessionChange = () => {
            const savedUser = localStorage.getItem('user');
            const savedToken = localStorage.getItem('authToken');
            if (savedUser && savedToken) {
                const parsedUser = JSON.parse(savedUser);
                const normalizedRole = normalizeRole(parsedUser.role);
                setUser({ ...parsedUser, role: normalizedRole });
                setRole(normalizedRole);
            } else {
                setUser(null);
                setRole(null);
            }
        };

        window.addEventListener('auth-session-changed', handleAuthSessionChange);
        return () => window.removeEventListener('auth-session-changed', handleAuthSessionChange);
    }, []);

    const apiBase = '/api';

    const requestEmailOtp = async (email: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBase}/auth/register/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Failed to send OTP');
            }

            return data;
        } finally {
            setIsLoading(false);
        }
    };

    const verifyEmailOtp = async (email: string, otp: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBase}/auth/register/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'OTP verification failed');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (userData: RegisterData, preferredRole?: UserRole): Promise<User> => {
        setIsLoading(true);

        try {
            const payload: Record<string, unknown> = {
                name: userData.name,
                email: userData.email,
                password: userData.password,
                role: toBackendRole(userData.role),
                authProvider: 'local',
            };

            if (userData.phone) {
                payload.phone = userData.phone;
            }

            if (userData.companyName || userData.shopName) {
                payload.companyName = userData.companyName || userData.shopName;
            }

            if (userData.businessType) {
                payload.businessType = userData.businessType;
            }

            if (userData.location) {
                payload.location = userData.location;
            }

            if (userData.farmSize) {
                payload.farmSize = userData.farmSize;
            }

            if (userData.soilType) {
                payload.soilType = userData.soilType;
            }

            if (userData.waterSource) {
                payload.waterSource = userData.waterSource;
            }

            const res = await fetch(`${apiBase}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            const normalizedRole = normalizeRole(preferredRole || data.user?.role || userData.role);
            const newUser: User = {
                id: data.user?.id || data.user?._id || Date.now().toString(),
                email: data.user?.email || userData.email,
                name: data.user?.name || userData.name,
                role: normalizedRole,
                phone: data.user?.phone || userData.phone,
            };

            localStorage.setItem('user', JSON.stringify(newUser));
            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }

            setUser(newUser);
            setRole(newUser.role);
            window.dispatchEvent(new Event('auth-session-changed'));
            return newUser;
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string, preferredRole?: UserRole): Promise<User> => {
        setIsLoading(true);

        try {
            const res = await fetch(`${apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            const normalizedRole = normalizeRole(preferredRole || data.user?.role);
            const loggedUser: User = {
                id: data.user?.id || data.user?._id || Date.now().toString(),
                email: data.user?.email,
                name: data.user?.name,
                role: normalizedRole,
                phone: data.user?.phone,
                profileImage: data.user?.profileImage,
            };

            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(loggedUser));
            setUser(loggedUser);
            setRole(loggedUser.role);
            window.dispatchEvent(new Event('auth-session-changed'));
            return loggedUser;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        setUser(null);
        setRole(null);
        // Market preferences are stored server-side; no local cleanup needed
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                role,
                isLoading,
                isAuthenticated: !!user,
                requestEmailOtp,
                verifyEmailOtp,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}