import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '@/api/apiClient';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { setupPushNotifications, removePushNotifications } from '@/lib/pushNotifications';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setIsAuthenticated(false);
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/';
      }
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      setupPushNotifications();
    }
  }, [isAuthenticated, user]);

  const initializeAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      
      const token = authAPI.initialize();
      
      if (token) {
        await checkUserAuth();
      } else {
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await authAPI.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      const data = await authAPI.login(email, password, rememberMe);
      if (data.two_factor_required) {
        return data;
      }
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const googleLogin = async (idToken) => {
    try {
      const data = await authAPI.googleLogin(idToken);
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const verify2FA = async (twoFactorToken, token) => {
    try {
      const data = await authAPI.verify2FALogin(twoFactorToken, token);
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const data = await authAPI.register(userData);
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const registerBiometrics = async () => {
    try {
      const options = await authAPI.getWebAuthnRegisterOptions();
      const attResp = await startRegistration(options);
      const verification = await authAPI.verifyWebAuthnRegister(attResp);
      
      if (verification.verified) {
        // Refresh user data to include new authenticators
        await checkUserAuth();
      }
      return verification;
    } catch (error) {
      console.error('Biometric registration failed:', error);
      throw error;
    }
  };

  const loginBiometrics = async (email) => {
    try {
      const options = await authAPI.getWebAuthnLoginOptions(email);
      const asseResp = await startAuthentication(options);
      const data = await authAPI.verifyWebAuthnLogin(email, asseResp);
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      console.error('Biometric login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    removePushNotifications();
    authAPI.logout();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      authError,
      clearAuthError,
      login,
      googleLogin,
      verify2FA,
      register,
      registerBiometrics,
      loginBiometrics,
      logout,
      navigateToLogin,
      checkUserAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
