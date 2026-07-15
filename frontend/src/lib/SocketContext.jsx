import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './AuthContext';
import { showLocalNotification } from './pushNotifications';
import { notificationsAPI } from '@/api/apiClient';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

function resolveSocketUrl() {
  const configured = import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin;

  // Same localhost -> 10.0.2.2 redirect as apiClient.js: on the Android
  // emulator, "localhost" points at the device, not the dev machine.
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return configured.replace(/^(https?:\/\/)localhost/, '$110.0.2.2');
  }

  return configured;
}

const SOCKET_URL = resolveSocketUrl();

// Singleton socket instance to prevent multiple connections
let socketInstance = null;

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // Reuse existing socket or create new one
    if (socketInstance) {
      setSocket(socketInstance);
      return;
    }

    const token = localStorage.getItem('iqon_token');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5, // Reduced attempts
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000, // Reduced max delay
      randomizationFactor: 0.3,
    });

    socketInstance = newSocket;

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attempt) => {
      setIsConnected(true);
      console.info(`WebSocket reconnected after ${attempt} attempt(s)`);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnect error:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('WebSocket reconnect failed after maximum attempts');
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    newSocket.on('notification:new', (notification) => {
      console.log('New notification received via socket:', notification);
      showLocalNotification(
        notification.title || 'New Notification',
        notification.body || '',
        { link: notification.link, ...notification.metadata }
      );
    });

    setSocket(newSocket);

    const handleOnline = () => {
      if (newSocket && !newSocket.connected) {
        console.log('Device back online, reconnecting socket...');
        newSocket.connect();
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [user]);

  const emit = (event, data) => {
    if (socket) {
      socket.emit(event, data);
    }
  };

  const on = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket.off(event, callback);
    }
    return () => {};
  };

  const off = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, emit, on }}>
      {children}
    </SocketContext.Provider>
  );
};
