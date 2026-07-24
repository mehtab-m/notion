import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, pingActivity } from '../utils/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    window.location.href = '/';
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(userData);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  // Record app usage for active-user analysis (throttled on server)
  useEffect(() => {
    if (!user) return undefined;
    pingActivity()
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
    const id = setInterval(() => {
      pingActivity().catch(() => {});
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [user?._id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user,
        isDeveloper: user?.isDeveloper === true,
        isAdmin: user?.role === 'admin',
        needsDeveloperChoice: user != null && user.isDeveloper == null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { TOKEN_KEY };
