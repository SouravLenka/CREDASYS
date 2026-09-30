"use client";
import { createContext, useContext, useState, ReactNode } from "react";

export interface DemoUser {
  uid: string;
  displayName: string;
  email: string;
}

interface AuthContextValue {
  user: DemoUser | null;
  loading: boolean;
}

const demoUser: DemoUser = {
  uid: "demo-user",
  displayName: "CREDASYS Demo User",
  email: "demo@credasys.ai",
};

const AuthContext = createContext<AuthContextValue>({ user: demoUser, loading: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<DemoUser | null>(demoUser);
  return <AuthContext.Provider value={{ user, loading: false }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
