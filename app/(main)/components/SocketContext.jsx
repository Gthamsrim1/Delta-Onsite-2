'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = (props) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    let socketIo;

    const initSocket = async () => {
      try {
        const res = await fetch('/api/socket');
        console.log("API route hit, initializing socket.io...");

        socketIo = io({ path: '/api/socketio' });

        socketIo.on('connect', () => {
          console.log('Socket.io connected:', socketIo.id);
        });

        setSocket(socketIo);
      } catch (err) {
        console.error("Socket fetch/init failed:", err);
      }
    };

    initSocket();

    return () => {
      if (socketIo) socketIo.disconnect();
    };
  }, []);

  const value = useMemo(() => ({ socket }), [socket]);

  return (
    <SocketContext.Provider value={value}>
      {props.children}
    </SocketContext.Provider>
  );
};
