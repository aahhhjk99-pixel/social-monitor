import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase, supabaseReady } from "../lib/supabase";

export type AppUser = {
  uid: string;
  email: string | null;
};

type AuthValue = {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function mapUser(user: User | null): AppUser | null {
  if (!user) return null;

  return {
    uid: user.id,
    email: user.email ?? null
  };
}

function ensureConfigured() {
  if (!supabaseReady) {
    throw new Error(
      "إعدادات Supabase غير مكتملة. تحقق من متغيرات البيئة."
    );
  }
}

export function AuthProvider({
  children
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!supabaseReady) {
      setLoading(false);
      return;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setUser(mapUser(session?.user ?? null));
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<void> => {
    ensureConfigured();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) throw error;
  };

  const register = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    ensureConfigured();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) throw error;

    return Boolean(data.session);
  };

  const logout = async (): Promise<void> => {
    ensureConfigured();

    const { error } = await supabase.auth.signOut();

    if (error) throw error;
  };

  const value: AuthValue = {
    user,
    loading,
    signIn,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
