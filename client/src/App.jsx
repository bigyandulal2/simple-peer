import React, { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import "./App.css";
import { io } from "socket.io-client";

// Backend signaling server (your ngrok or hosted server)
const url = "https://c9f9a38b4c64.ngrok-free.app";
const socket = io(url, {
  transports: ["websocket"],
});

export default function App() {
  const [myPeerId, setMyPeerId] = useState("");
  const [availablePeers, setAvailablePeers] = useState([]);
  const [callingToId, setCallingToId] = useState(null);

  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    const peer = new Peer({
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:numb.viagenie.ca",
            credential: "muazkh",
            username: "webrtc@live.com",
          },
        ],
      },
    });

    peerRef.current = peer;

    peer.on("open", (id) => {
      setMyPeerId(id);
      socket.emit("peerId", id);
    });

    peer.on("call", async (call) => {
      if (!window.confirm(`Incoming call from ${call.peer}. Accept?`)) {
        call.close();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play();

        call.answer(stream);

        call.on("stream", (remoteStream) => {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play();
        });

        call.on("close", cleanupStreamsAndVideos);
        call.on("error", cleanupStreamsAndVideos);
      } catch (err) {
        console.error("Media error:", err);
        alert("Could not access camera/mic.");
      }
    });

    peer.on("error", (err) => console.error("PeerJS error:", err));

    socket.on("peerIdAvailable", (id) => {
      if (id !== myPeerId && !availablePeers.includes(id)) {
        setAvailablePeers((prev) => [...prev, id]);
      }
    });

    socket.on("activePeerIds", (ids) => {
      const filtered = ids.filter((id) => id !== myPeerId);
      setAvailablePeers(filtered);
    });

    socket.on("peerIdUnavailable", (id) => {
      setAvailablePeers((prev) => prev.filter((pid) => pid !== id));
      if (callingToId === id) {
        alert(`Peer ${id} disconnected`);
        hangUp();
      }
    });

    return () => {
      peerRef.current?.destroy();
      cleanupStreamsAndVideos();
      socket.off("peerIdAvailable");
      socket.off("activePeerIds");
      socket.off("peerIdUnavailable");
    };
  }, []);

  const cleanupStreamsAndVideos = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCallingToId(null);
  };

  const startCall = async (remotePeerId) => {
    if (!remotePeerId || remotePeerId === myPeerId)
      return alert("Invalid peer ID.");

    setCallingToId(remotePeerId);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play();

      const call = peerRef.current.call(remotePeerId, stream);
      call.on("stream", (remoteStream) => {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play();
      });
      call.on("close", cleanupStreamsAndVideos);
      call.on("error", (err) => {
        console.error("Call error:", err);
        cleanupStreamsAndVideos();
      });
    } catch (err) {
      console.error("Call failed:", err);
      alert("Failed to start call.");
      cleanupStreamsAndVideos();
    }
  };

  const hangUp = () => {
    cleanupStreamsAndVideos();
  };

  return (
    <div className="App">
      <h1>Automated Video Call 📞</h1>
      <h3>
        My Peer ID:{" "}
        <span style={{ color: "blue" }}>{myPeerId || "Connecting..."}</span>
      </h3>
      <hr />

      {availablePeers.length > 0 ? (
        <ul>
          {availablePeers.map((peerId) => (
            <li key={peerId}>
              {peerId}
              <button
                onClick={() => startCall(peerId)}
                disabled={!!callingToId}
                style={{ marginLeft: "10px" }}
              >
                {callingToId === peerId ? "Calling..." : "Call Now"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No peers available. Try opening another tab.</p>
      )}

      {callingToId && (
        <button
          onClick={hangUp}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            backgroundColor: "red",
            color: "white",
            border: "none",
            borderRadius: "5px",
          }}
        >
          Hang Up
        </button>
      )}

      <div
        style={{
          display: "flex",
          gap: "20px",
          marginTop: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h4>Local Video 🤳</h4>
          <video
            ref={localVideoRef}
            muted
            autoPlay
            playsInline
            width={300}
            style={{ border: "1px solid gray", background: "#f0f0f0" }}
          />
        </div>
        <div>
          <h4>Remote Video 📽️</h4>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            width={300}
            style={{ border: "1px solid gray", background: "#f0f0f0" }}
          />
        </div>
      </div>
    </div>
  );
}
