import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext({
  isAuthenticated: false,
  login: (user: any) => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('user'));

  const login = (user: any) => {
    sessionStorage.setItem('user', JSON.stringify(user));
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  useEffect(() => {
    setIsAuthenticated(!!sessionStorage.getItem('user'));
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
