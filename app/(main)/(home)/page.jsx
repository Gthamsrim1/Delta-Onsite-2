'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useSocket } from '../components/SocketContext'
import { useRouter } from 'next/navigation';

const Page = () => {
  const router = useRouter();
  const { socket } = useSocket();

  const [email, setEmail] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const handleJoinRoom = () => {
    setError("");

    const trimmedEmail = email.trim();
    const trimmedRoomId = roomId.trim();

    if (!trimmedEmail) {
      setError("Please enter your email address");
      return;
    }

    if (!trimmedRoomId) {
      setError("Please enter a room ID");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!socket || !socket.connected) {
      setError("Connection lost. Please refresh the page and try again.");
      return;
    }

    setIsJoining(true);
    console.log("📨 Sending join-room:", { email: trimmedEmail, roomId: trimmedRoomId });
    socket.emit('join-room', { email: trimmedEmail, roomId: trimmedRoomId });
  };

  const handleJoinedRoom = useCallback(({ roomId }) => {
    setIsJoining(false);
    router.push(`/meeting/${roomId}`);
  }, [router]);



  const handleError = useCallback((errorData) => {
    setIsJoining(false);
    setError(errorData.message || "An error occurred");
    console.error("Socket error:", errorData);
  }, []);

  const handleSocketConnect = useCallback(() => {
    setIsSocketConnected(true);
    setError("");
    console.log("Socket connected");
  }, []);

  const handleSocketDisconnect = useCallback(() => {
    setIsSocketConnected(false);
    setIsJoining(false);
    setError("Connection lost. Please refresh the page.");
    console.log("Socket disconnected");
  }, []);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isJoining) {
      handleJoinRoom();
    }
  };

  useEffect(() => {
    if (!socket) return;

    setIsSocketConnected(socket.connected);

    socket.on('joined-room', handleJoinedRoom);
    socket.on('error', handleError);
    socket.on('connect', handleSocketConnect);
    socket.on('disconnect', handleSocketDisconnect);

    return () => {
      socket.off('joined-room', handleJoinedRoom);
      socket.off('error', handleError);
      socket.off('connect', handleSocketConnect);
      socket.off('disconnect', handleSocketDisconnect);
    };
  }, [socket, handleJoinedRoom, handleError, handleSocketConnect, handleSocketDisconnect]);

  return (
    <div className='h-screen w-screen text-black flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-blue-50 to-indigo-100'>
      <div className='bg-white rounded-2xl shadow-xl p-8 w-full max-w-md'>
        <h1 className='text-2xl font-bold text-center mb-6 text-gray-800'>
          Join Video Call
        </h1>
        
        <div className='mb-4 text-center'>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
            isSocketConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${
              isSocketConnected ? 'bg-green-400' : 'bg-red-400'
            }`}></span>
            {isSocketConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm'>
            {error}
          </div>
        )}

        <div className='space-y-4'>
          <input
            placeholder='Email Address'
            type='email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isJoining || !isSocketConnected}
            className='w-full rounded-lg border-gray-300 px-4 py-3 border-2 focus:border-blue-500 focus:outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed'
          />
          <input
            placeholder='Room ID'
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isJoining || !isSocketConnected}
            className='w-full rounded-lg border-gray-300 px-4 py-3 border-2 focus:border-blue-500 focus:outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed'
          />
          <button
            onClick={handleJoinRoom}
            disabled={isJoining || !isSocketConnected}
            className='w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 hover:scale-[1.02] active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none cursor-pointer transition-all duration-200 font-medium'
          >
            {isJoining ? (
              <span className='flex items-center justify-center'>
                <svg className='animate-spin -ml-1 mr-3 h-5 w-5 text-white' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
                  <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                  <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
                </svg>
                Joining Room...
              </span>
            ) : (
              'Join Room'
            )}
          </button>
        </div>

        <p className='text-xs text-gray-500 text-center mt-4'>
          Make sure you have camera and microphone permissions enabled
        </p>
      </div>
    </div>
  );
};

export default Page;