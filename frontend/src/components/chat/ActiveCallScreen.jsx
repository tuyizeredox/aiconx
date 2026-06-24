import { useState, useEffect, useRef, useCallback } from "react";
import {
  PhoneOff, Mic, MicOff, Volume2, VolumeX, Camera, CameraOff,
  Maximize, Minimize, Loader2, User
} from "lucide-react";
import { motion } from "framer-motion";
import { callsAPI } from "@/api/apiClient";
import { useSocket } from "@/lib/SocketContext";

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ActiveCallScreen({
  call,
  currentUser,
  isIncoming,
  onEndCall,
  onCallEnded,
}) {
  const [duration, setDuration] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(call?.call_type === "video");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [callPhase, setCallPhase] = useState(isIncoming ? "ringing" : "connecting");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const { on, emit } = useSocket();

  const otherParty = isIncoming
    ? call?.caller_username
    : call?.callee_username;
  const otherPartyName = isIncoming
    ? call?.caller_name
    : call?.callee_name;

  const ICE_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const endCall = useCallback(async () => {
    try {
      await callsAPI.end(call._id, { duration });
    } catch (err) {
      console.error("Failed to end call:", err);
    }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    onCallEnded();
  }, [call, duration, localStream, onCallEnded]);

  useEffect(() => {
    durationIntervalRef.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
    return () => clearInterval(durationIntervalRef.current);
  }, []);

  const initiatorRef = useRef(!isIncoming);

  const setupPeerConnection = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: call.call_type === "video",
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && emit) {
          emit("call:ice-candidate", {
            callId: call._id,
            candidate: event.candidate,
          });
        }
      };

      const initiator = initiatorRef.current;
      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit("call:offer", {
          callId: call._id,
          sdp: pc.localDescription,
        });
      }

      setCallPhase("connected");
    } catch (err) {
      console.error("Media access error:", err);
      setCallPhase("failed");
    }
  }, [call, callPhase, isIncoming, emit]);

  useEffect(() => {
    if (!call || callPhase !== "connecting") return;
    setupPeerConnection();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [call, callPhase, setupPeerConnection]);

  useEffect(() => {
    if (!on || !call) return;
    const unsubOffer = on("call:offer", async (data) => {
      if (data.callId !== call._id) return;
      try {
        await peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription(data.sdp)
        );
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        emit("call:answer", {
          callId: call._id,
          sdp: peerConnectionRef.current.localDescription,
        });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    const unsubAnswer = on("call:answer", async (data) => {
      if (data.callId !== call._id) return;
      try {
        await peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription(data.sdp)
        );
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    const unsubIce = on("call:ice-candidate", async (data) => {
      if (data.callId !== call._id) return;
      try {
        await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    const unsubEnd = on("call:ended", (data) => {
      if (data.call?._id === call._id) {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (peerConnectionRef.current) peerConnectionRef.current.close();
        onCallEnded();
      }
    });

    const unsubRejected = on("call:rejected", (data) => {
      if (data.call?._id === call._id) {
        onCallEnded();
      }
    });

    return () => {
      unsubOffer?.();
      unsubAnswer?.();
      unsubIce?.();
      unsubEnd?.();
      unsubRejected?.();
    };
  }, [on, call, emit, localStream, onCallEnded]);

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => (t.enabled = !micOn));
    }
    setMicOn(m => !m);
  };

  const toggleSpeaker = () => {
    setSpeakerOn(s => !s);
    if (remoteStream) {
      remoteStream.getAudioTracks().forEach(t => (t.enabled = speakerOn));
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => (t.enabled = cameraOn));
    }
    setCameraOn(c => !c);
  };

  const toggleMinimize = () => setIsMinimized(m => !m);
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(f => !f);
  };

  const handleAnswerClick = async () => {
    setIsAnswering(true);
    try {
      await callsAPI.answer(call._id);
      setCallPhase("connecting");
    } catch (err) {
      console.error("Failed to answer call:", err);
      setIsAnswering(false);
    }
  };

  if (isMinimized) {
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 right-4 z-[90] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3 cursor-pointer"
        onClick={toggleMinimize}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold">
          {otherPartyName?.[0]?.toUpperCase() || "U"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{otherPartyName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {callPhase === "connected" ? formatDuration(duration) : callPhase === "connecting" ? "Connecting..." : "Ringing..."}
          </p>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
        <PhoneOff className="w-4 h-4 text-red-500 ml-1" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[90] bg-slate-900 flex flex-col ${isFullscreen ? "" : "p-2 md:p-4"}`}
    >
      {callPhase === "ringing" && isIncoming && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/90 to-orange-900/90 z-10 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white text-4xl font-bold mx-auto mb-6 shadow-2xl"
            >
              {otherPartyName?.[0]?.toUpperCase() || "U"}
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-1">{otherPartyName}</h2>
            <p className="text-sm text-orange-200 mb-1">@{otherParty}</p>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-xs font-semibold text-orange-300 uppercase tracking-widest mb-8"
            >
              Incoming {call.call_type === "video" ? "Video" : "Voice"} Call
            </motion.p>
            <div className="flex items-center justify-center gap-8">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={endCall}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg"
              >
                <PhoneOff className="w-7 h-7 text-white rotate-135" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleAnswerClick}
                disabled={isAnswering}
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg"
              >
                {isAnswering ? (
                  <Loader2 className="w-7 h-7 text-white animate-spin" />
                ) : call.call_type === "video" ? (
                  <Video className="w-7 h-7 text-white" />
                ) : (
                  <Phone className="w-7 h-7 text-white" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {callPhase === "connecting" && !isIncoming && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/90 to-orange-900/90 z-10 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Connecting...</p>
          </div>
        </div>
      )}

      {callPhase === "failed" && (
        <div className="absolute inset-0 bg-slate-900 z-10 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white font-medium mb-3">Connection failed</p>
            <button
              onClick={endCall}
              className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm"
            >
              End Call
            </button>
          </div>
        </div>
      )}

      {/* Video area */}
      {call.call_type === "video" && (
        <div className="relative flex-1 min-h-0 bg-black rounded-2xl overflow-hidden mb-4">
          {/* Remote video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`absolute inset-0 w-full h-full object-cover ${remoteStream ? "opacity-100" : "opacity-30"}`}
          />
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                {callPhase === "connected" ? (
                  <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto" />
                ) : (
                  <User className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                )}
                <p className="text-slate-400 text-sm">
                  {callPhase === "connected" ? "Waiting for video..." : "Connecting..."}
                </p>
              </div>
            </div>
          )}

          {/* Local video PIP */}
          {cameraOn && (
            <motion.div
              initial={{ x: 20, y: 20, opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              className="absolute bottom-4 right-4 w-28 h-40 md:w-36 md:h-48 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 bg-black"
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </motion.div>
          )}
        </div>
      )}

      {/* Voice call background */}
      {call.call_type === "voice" && (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl mb-4">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white text-3xl font-bold shadow-xl"
          >
            {otherPartyName?.[0]?.toUpperCase() || "U"}
          </motion.div>
        </div>
      )}

      {/* Call info bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
            {otherPartyName?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{otherPartyName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDuration(duration)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMinimize}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            title="Minimize"
          >
            <Minimize className="w-4 h-4" />
          </button>
          {call.call_type === "video" && (
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
              title="Fullscreen"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 flex items-center justify-center gap-4 shadow-lg">
        <ControlButton
          icon={micOn ? Mic : MicOff}
          label={micOn ? "Mute" : "Unmute"}
          active={micOn}
          onClick={toggleMic}
        />
        <ControlButton
          icon={speakerOn ? Volume2 : VolumeX}
          label={speakerOn ? "Mute Speaker" : "Unmute Speaker"}
          active={speakerOn}
          onClick={toggleSpeaker}
        />
        {call.call_type === "video" && (
          <ControlButton
            icon={cameraOn ? Camera : CameraOff}
            label={cameraOn ? "Off Camera" : "On Camera"}
            active={cameraOn}
            onClick={toggleCamera}
          />
        )}
        <ControlButton
          icon={PhoneOff}
          label="End"
          active={false}
          onClick={endCall}
          variant="danger"
        />
      </div>
    </motion.div>
  );
}

function ControlButton({ icon: Icon, label, active, onClick, variant = "default" }) {
  const bgClass = variant === "danger"
    ? "bg-red-500 hover:bg-red-600 text-white"
    : active
      ? "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white"
      : "bg-slate-100 dark:bg-slate-700 text-red-500";

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={label}
      className={`w-12 h-12 rounded-full flex items-center justify-center ${bgClass} transition-colors shadow-sm`}
    >
      <Icon className="w-5 h-5" />
    </motion.button>
  );
}

export default ActiveCallScreen;
