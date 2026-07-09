"use client";

import { createContext, useContext, ReactNode } from "react";
import { Socket } from "socket.io-client";

interface SocketContextProps {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextProps>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  // Socket.IO logic will be implemented here
  return (
    <SocketContext.Provider value={{ socket: null, isConnected: false }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
