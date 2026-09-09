/**
 * WorkTree X Feature: Auth Service
 * Wraps Supabase Auth sessions.
 */

import { getSupabase } from '../../../lib/supabase/client.js';

export const AuthService = {
  async signUp(email, password, fullName) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const sb = await getSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const sb = await getSupabase();
    const { data: { user }, error } = await sb.auth.getUser();
    if (error) return null;
    return user;
  },

  async onAuthStateChange(callback) {
    const sb = await getSupabase();
    return sb.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
};
