'use client'
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useSocket } from '../../components/SocketContext'
import { useRouter } from 'next/navigation';

const Page = () => {
  const router = useRouter();
  const { socket } = useSocket();
  
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map()); 
  const [peerConnections, setPeerConnections] = useState(new Map()); 
  const [incomingCall, setIncomingCall] = useState(null);
  const [error, setError] = useState("");
  const [callStatus, setCallStatus] = useState("");
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionStates, setConnectionStates] = useState(new Map()); 
  const [isInitialized, setIsInitialized] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map()); 
  const processedUsers = useRef(new Set());

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  };

  const initializeLocalMedia = useCallback(async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      console.log('Local media initialized:', stream.getTracks().map(t => t.kind));
      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      setError('Failed to access camera/microphone. Please check permissions.');
      throw error;
    }
  }, []);

  const createPeerConnection = useCallback((email, isInitiator = false) => {
    const pc = new RTCPeerConnection(iceServers);
    
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${email}:`, pc.connectionState);
      setConnectionStates(prev => new Map(prev.set(email, pc.connectionState)));
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${email}:`, event.track.kind);
      const [stream] = event.streams;
      setRemoteStreams(prev => new Map(prev.set(email, stream)));
      
      const videoRef = remoteVideoRefs.current.get(email);
      if (videoRef && videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log(`Sending ICE candidate to ${email}`);
        socket.emit('ice-candidate', {
          email: email,
          candidate: event.candidate
        });
      }
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    setPeerConnections(prev => new Map(prev.set(email, pc)));
    return pc;
  }, [localStream, socket]);

  const createOffer = useCallback(async (email) => {
    try {
      let pc = peerConnections.get(email);
      if (!pc) {
        pc = createPeerConnection(email, true);
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await pc.setLocalDescription(offer);
      console.log(`Created offer for ${email}`);
      
      socket.emit('call-user', { email, offer });
    } catch (error) {
      console.error(`Error creating offer for ${email}:`, error);
    }
  }, [peerConnections, createPeerConnection, socket]);

  const handleIncomingCall = useCallback(async (data) => {
    try {
      const { from, offer } = data;
      console.log("Incoming call from", from);

      if (!localStream) {
        socket.emit('call-rejected', { email: from, reason: 'Not ready' });
        return;
      }

      let pc = peerConnections.get(from);
      if (!pc) {
        pc = createPeerConnection(from, false);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('call-accepted', { email: from, ans: answer });
      console.log(`Auto-accepted call from ${from}`);
      
    } catch (error) {
      console.error('Error handling incoming call:', error);
    }
  }, [localStream, peerConnections, createPeerConnection, socket]);

  const handleCallAccepted = useCallback(async (data) => {
    try {
      const { ans, from } = data;
      console.log("Call accepted by", from);
      
      const pc = peerConnections.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(ans));
      }
    } catch (error) {
      console.error('Error handling call acceptance:', error);
    }
  }, [peerConnections]);

  const handleIceCandidate = useCallback((data) => {
    const { from, candidate } = data;
    console.log(`Received ICE candidate from ${from}`);
    
    const pc = peerConnections.get(from);
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    }
  }, [peerConnections]);

  const handleNewUserJoined = useCallback(async (data) => {
    try {
      const { email } = data;
      console.log(`New user joined: ${email}`);
      
      if (processedUsers.current.has(email)) {
        return;
      }
      
      processedUsers.current.add(email);
      
      setConnectedUsers(prev => {
        const filtered = prev.filter(user => user !== email);
        return [...filtered, email];
      });
      
      setCallStatus(`${email} joined the room`);
      setTimeout(() => setCallStatus(""), 3000);
      
      if (!localStream) {
        console.error("Local stream not ready");
        return;
      }

      // Wait a bit then create offer
      setTimeout(() => {
        createOffer(email);
      }, 1000);
      
    } catch (error) {
      console.error('Error handling new user:', error);
    }
  }, [localStream, createOffer]);

  const handleUserLeft = useCallback((data) => {
    const { email } = data;
    console.log(`User left: ${email}`);
    
    processedUsers.current.delete(email);
    
    const pc = peerConnections.get(email);
    if (pc) {
      pc.close();
      setPeerConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(email);
        return newMap;
      });
    }
    
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(email);
      return newMap;
    });
    
    setConnectionStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(email);
      return newMap;
    });
    
    setConnectedUsers(prev => prev.filter(user => user !== email));
    
    setCallStatus(`${email} left the room`);
    setTimeout(() => setCallStatus(""), 3000);
  }, [peerConnections]);

  const handleJoinedRoom = useCallback(({ roomId, existingUsers }) => {
    console.log('Joined room:', roomId, 'Existing users:', existingUsers);
    
    processedUsers.current.clear();
    
    if (existingUsers && existingUsers.length > 0) {
      setConnectedUsers(existingUsers);
      
      setTimeout(() => {
        existingUsers.forEach(email => {
          handleNewUserJoined({ email });
        });
      }, 2000);
    } else {
      setConnectedUsers([]);
    }
  }, [handleNewUserJoined]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);

  const leaveRoom = useCallback(() => {
    peerConnections.forEach(pc => pc.close());
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (socket) {
      socket.emit('leave-room');
    }
    
    router.push('/');
  }, [peerConnections, localStream, socket, router]);

  useEffect(() => {
    const initialize = async () => {
      if (!isInitialized) {
        try {
          await initializeLocalMedia();
          setIsInitialized(true);
          setCallStatus('Ready for video calls');
          setTimeout(() => setCallStatus(""), 3000);
        } catch (error) {
          console.error('Failed to initialize:', error);
        }
      }
    };

    initialize();
  }, [initializeLocalMedia, isInitialized]);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('user-joined', handleNewUserJoined);
    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('joined-room', handleJoinedRoom);
    socket.on('error', (errorData) => {
      setError(errorData.message || "Connection error occurred");
    });

    return () => {
      socket.off('user-joined', handleNewUserJoined);
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
      socket.off('joined-room', handleJoinedRoom);
      socket.off('error');
    };
  }, [socket, handleNewUserJoined, handleIncomingCall, handleCallAccepted, handleIceCandidate, handleUserLeft, handleJoinedRoom]);

  useEffect(() => {
    remoteStreams.forEach((stream, email) => {
      if (!remoteVideoRefs.current.has(email)) {
        remoteVideoRefs.current.set(email, React.createRef());
      }
      
      const videoRef = remoteVideoRefs.current.get(email);
      if (videoRef && videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const getGridLayout = (count) => {
    if (count === 0) return { cols: 1, rows: 1 };
    if (count === 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 4, rows: Math.ceil(count / 4) };
  };

  const remoteStreamsArray = Array.from(remoteStreams.entries());
  const { cols, rows } = getGridLayout(remoteStreamsArray.length);

  return (
    <div className='h-screen w-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 relative overflow-hidden'>
      <div className='absolute top-0 left-0 right-0 z-10 bg-black/20 backdrop-blur-sm'>
        <div className='flex justify-between items-center p-4'>
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-2'>
              <div className={`w-3 h-3 rounded-full ${localStream ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className='text-white text-sm font-medium'>
                {localStream ? 'Camera Ready' : 'Camera Not Ready'}
              </span>
            </div>
            
            <div className='text-white text-sm'>
              Connected: {connectedUsers.length} users
            </div>
          </div>
          
          <button
            onClick={leaveRoom}
            className='bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors'
          >
            Leave Room
          </button>
        </div>
      </div>

      <div className='relative h-full pt-16 pb-20'>
        {remoteStreamsArray.length > 0 ? (
          <div 
            className='grid gap-2 p-4 h-full'
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`
            }}
          >
            {remoteStreamsArray.map(([email, stream]) => {
              if (!remoteVideoRefs.current.has(email)) {
                remoteVideoRefs.current.set(email, React.createRef());
              }
              
              const videoRef = remoteVideoRefs.current.get(email);
              const connectionState = connectionStates.get(email) || 'new';
              
              return (
                <div key={email} className='relative bg-black rounded-lg overflow-hidden'>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className='w-full h-full object-cover'
                  />
                  <div className='absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded'>
                    {email}
                  </div>
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                    connectionState === 'connected' ? 'bg-green-400' : 
                    connectionState === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
                  }`}></div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className='w-full h-full flex items-center justify-center'>
            <div className='text-center text-white'>
              <div className='w-32 h-32 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4'>
                <svg className='w-16 h-16 text-gray-400' fill='currentColor' viewBox='0 0 20 20'>
                  <path fillRule='evenodd' d='M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z' clipRule='evenodd' />
                </svg>
              </div>
              <p className='text-lg'>Waiting for others to join...</p>
              <p className='text-sm text-gray-400 mt-2'>Share your room ID with friends to start the call</p>
            </div>
          </div>
        )}

        <div className='absolute top-4 right-4 w-48 h-36 bg-black rounded-lg overflow-hidden shadow-lg z-20'>
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className='w-full h-full object-cover'
            />
          ) : (
            <div className='w-full h-full flex items-center justify-center bg-gray-800'>
              <div className='text-center text-white'>
                <svg className='w-8 h-8 mx-auto mb-2' fill='currentColor' viewBox='0 0 20 20'>
                  <path fillRule='evenodd' d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z' clipRule='evenodd' />
                </svg>
                <p className='text-xs'>No Camera</p>
              </div>
            </div>
          )}
          <div className='absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded'>
            You
          </div>
        </div>
      </div>

      <div className='absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20'>
        <div className='flex items-center space-x-4 bg-black/50 backdrop-blur-sm rounded-full px-6 py-3'>
          <button
            onClick={toggleAudio}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isAudioEnabled 
                ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isAudioEnabled ? (
              <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 20 20'>
                <path fillRule='evenodd' d='M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z' clipRule='evenodd' />
              </svg>
            ) : (
              <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 20 20'>
                <path fillRule='evenodd' d='M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.293 8.293a1 1 0 011.414 0L18 9.586l1.293-1.293a1 1 0 111.414 1.414L19.414 11l1.293 1.293a1 1 0 01-1.414 1.414L18 12.414l-1.293 1.293a1 1 0 01-1.414-1.414L16.586 11l-1.293-1.293a1 1 0 010-1.414z' clipRule='evenodd' />
              </svg>
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isVideoEnabled 
                ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isVideoEnabled ? (
              <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 20 20'>
                <path d='M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z' />
              </svg>
            ) : (
              <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 20 20'>
                <path fillRule='evenodd' d='M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A2 2 0 0018 13V7a1 1 0 00-1.447-.894l-2 1A1 1 0 0014 8v4c0 .368-.097.714-.268 1.014l-3.064-3.064C10.888 9.614 11 9.325 11 9V8a1 1 0 00-.553-.894L8.586 6.414 3.707 2.293zM4 6a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2v-.172L4.828 6H4z' clipRule='evenodd' />
              </svg>
            )}
          </button>
        </div>
      </div>

      {callStatus && (
        <div className='absolute top-20 left-1/2 transform -translate-x-1/2 z-20'>
          <div className='bg-blue-500/90 text-white px-4 py-2 rounded-lg backdrop-blur-sm'>
            {callStatus}
          </div>
        </div>
      )}

      {error && (
        <div className='absolute top-20 left-1/2 transform -translate-x-1/2 z-20'>
          <div className='bg-red-500/90 text-white px-4 py-2 rounded-lg backdrop-blur-sm flex items-center'>
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className='ml-2 text-white hover:text-gray-200'
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {connectedUsers.length > 0 && (
        <div className='absolute bottom-4 left-4 z-10'>
          <div className='bg-black/20 backdrop-blur-sm rounded-lg p-3 max-w-xs'>
            <h4 className='text-white text-sm font-medium mb-2'>
              Connected Users ({connectedUsers.length}):
            </h4>
            <div className='space-y-1 max-h-32 overflow-y-auto'>
              {connectedUsers.map((user, index) => (
                <div key={index} className='text-white text-xs bg-white/10 px-2 py-1 rounded flex items-center justify-between'>
                  <span className='truncate'>{user}</span>
                  <div className={`w-2 h-2 rounded-full ml-2 ${
                    connectionStates.get(user) === 'connected' ? 'bg-green-400' : 
                    connectionStates.get(user) === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
                  }`}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;