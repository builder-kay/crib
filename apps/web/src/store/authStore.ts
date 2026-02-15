import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";

type AuthState = {
  initialized: boolean;
  session: Session | null;
  user: User | null;
  setSession: (session: Session | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
};

let subscriptionReady = false;

export const useAuthStore = create<AuthState>((set) => ({
  initialized: false,
  session: null,
  user: null,
  setSession: (session) => {
    set({ session, user: session?.user ?? null, initialized: true });
  },
  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, initialized: true });

    if (!subscriptionReady) {
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null, initialized: true });
      });
      subscriptionReady = true;
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, initialized: true });
  }
}));