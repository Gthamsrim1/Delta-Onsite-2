'use client'
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const PeerContext = createContext();

export const usePeer = () => {
  const context = useContext(PeerContext);
  if (!context) {
    throw new Error('usePeer must be used within a PeerProvider');
  }
  return context;
};

export const PeerProvider = ({ children }) => {
  const [peer, setPeer] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState('new');
  const [permissionError, setPermissionError] = useState(null);
  
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const currentCallPartnerRef = useRef(null);

  const initializePeer = useCallback(async (socket) => {
    try {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ]
      };

      const pc = new RTCPeerConnection(configuration);
      socketRef.current = socket;
      
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        setConnectionState(pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
      };

      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        const [stream] = event.streams;
        setRemoteStream(stream);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current && currentCallPartnerRef.current) {
          console.log('Sending ICE candidate to:', currentCallPartnerRef.current);
          socketRef.current.emit('ice-candidate', {
            email: currentCallPartnerRef.current,
            candidate: event.candidate
          });
        }
      };

      peerRef.current = pc;
      setPeer(pc);
      
      return pc;
    } catch (error) {
      console.error('Error initializing peer connection:', error);
      throw error;
    }
  }, []);

  const getUserMedia = useCallback(async (videoEnabled = true, audioEnabled = true) => {
    try {
      setPermissionError(null);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }

      const constraints = {
        video: videoEnabled ? {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 },
          facingMode: 'user'
        } : false,
        audio: audioEnabled ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } : false
      };

      console.log('Requesting user media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got user media:', stream.getTracks().map(t => `${t.kind}: ${t.label}`));
    
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      setIsVideoEnabled(videoTrack ? videoTrack.enabled : false);
      setIsAudioEnabled(audioTrack ? audioTrack.enabled : false);
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      if (peerRef.current) {
        const senders = peerRef.current.getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            peerRef.current.removeTrack(sender);
          }
        });
        
        stream.getTracks().forEach(track => {
          console.log('Adding track to peer connection:', track.kind, track.label);
          peerRef.current.addTrack(track, stream);
        });
      }
      
      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      
      let errorMessage = 'Failed to access camera/microphone';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone access denied. Please allow permissions and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera/microphone does not meet the required constraints.';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Camera/microphone access blocked due to security restrictions.';
      }
      
      setPermissionError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const createOffer = useCallback(async (targetEmail) => {
    if (!peerRef.current) {
      throw new Error('Peer connection not initialized');
    }

    try {
      console.log('Creating offer for:', targetEmail);
      currentCallPartnerRef.current = targetEmail;
      
      const offer = await peerRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerRef.current.setLocalDescription(offer);
      console.log('Local description set (offer)');
      
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }, []);

  const createAnswer = useCallback(async (offer, fromEmail) => {
    if (!peerRef.current) {
      throw new Error('Peer connection not initialized');
    }

    try {
      console.log('Creating answer for offer from:', fromEmail);
      currentCallPartnerRef.current = fromEmail;
      
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote description set (offer)');
      
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      console.log('Local description set (answer)');
      
      return answer;
    } catch (error) {
      console.error('Error creating answer:', error);
      throw error;
    }
  }, []);

  const setRemoteAnswer = useCallback(async (answer) => {
    if (!peerRef.current) {
      throw new Error('Peer connection not initialized');
    }

    try {
      console.log('Setting remote answer');
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote description set (answer)');
    } catch (error) {
      console.error('Error setting remote answer:', error);
      throw error;
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log('Video toggled:', videoTrack.enabled);
      } else if (!isVideoEnabled) {
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: isAudioEnabled 
          });
          
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
          }
          
          localStreamRef.current = newStream;
          setLocalStream(newStream);
          setIsVideoEnabled(true);
          
          if (peerRef.current) {
            const senders = peerRef.current.getSenders();
            senders.forEach(sender => {
              if (sender.track) {
                peerRef.current.removeTrack(sender);
              }
            });
            
            newStream.getTracks().forEach(track => {
              peerRef.current.addTrack(track, newStream);
            });
          }
        } catch (error) {
          console.error('Error enabling video:', error);
        }
      }
    }
  }, [isAudioEnabled, isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log('Audio toggled:', audioTrack.enabled);
      }
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    if (!peerRef.current) {
      console.error('Peer connection not initialized for ICE candidate');
      return;
    }

    try {
      console.log('Adding ICE candidate');
      await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('Cleaning up peer connection and streams');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
      setPeer(null);
    }

    setRemoteStream(null);
    setConnectionState('closed');
    currentCallPartnerRef.current = null;
    socketRef.current = null;
  }, []);

  const testCameraAccess = useCallback(async () => {
    try {
      console.log('Testing camera access...');
      const testStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      console.log('Camera test successful:', testStream.getTracks().map(t => t.kind));
      testStream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Camera test failed:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const value = {
    peer,
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    permissionError,
    createOffer,
    createAnswer,
    setRemoteAnswer,
    handleIceCandidate,
    toggleVideo,
    toggleAudio,
    getUserMedia,
    cleanup,
    initializePeer,
    testCameraAccess
  };

  return <PeerContext.Provider value={value}>{children}</PeerContext.Provider>;
};