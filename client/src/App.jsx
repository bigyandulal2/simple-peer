// import React, { useEffect, useMemo, useRef, useState } from "react";
// import Peer from "peerjs"; // ✅ Correct default import
// import "./App.css";
// import { io } from "socket.io-client";
// const socket = io("https://localhost:4000", {
//   transports: ["websockets"],
// });
// export default function App() {
//   const [peerId, setPeerId] = useState("");
//   const [remotePeerId, setRemotePeerId] = useState("");
//   const peerRef = useRef(null);
//   const localVideoRef = useRef(null);
//   const remoteVideoRef = useRef(null);
//   const localStreamRef = useRef(null);

//   useEffect(() => {
//     const peer = new Peer(); // 👈 Create peer instance
//     peerRef.current = peer;

//     // Show my peer ID
//     peer.on("open", (id) => {
//       console.log("My peer ID:", id);
//       setPeerId(id);
//       socket.emit("peerId", id);
//     });

//     // Listen for incoming call
//     peer.on("call", async (call) => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: true,
//           audio: true,
//         });
//         localStreamRef.current = stream;
//         localVideoRef.current.srcObject = stream;
//         localVideoRef.current.play();

//         call.answer(stream); // ✅ Answer with your stream

//         call.on("stream", (remoteStream) => {
//           remoteVideoRef.current.srcObject = remoteStream;
//           remoteVideoRef.current.play();
//         });
//       } catch (err) {
//         console.error("Error accessing media for incoming call:", err);
//       }
//       socket.on("peerId", (id) => {
//         setRemotePeerId(id);
//       });
//       return () => {};
//     });
//   }, []);

//   // Call another peer
//   const Call = async (id) => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: true,
//         audio: true,
//       });
//       localStreamRef.current = stream;
//       localVideoRef.current.srcObject = stream;

//       const call = peerRef.current.call(id, stream);

//       call.on("stream", (remoteStream) => {
//         remoteVideoRef.current.srcObject = remoteStream;
//         remoteVideoRef.current.play();
//       });
//     } catch (err) {
//       console.error("Failed to make call:", err);
//     }
//   };

//   return (
//     <div>
//       <h3>My Peer ID: {peerId}</h3>
//       <button onClick={() => Call(remotePeerId)}>Call</button>

//       <div className="video-parent" style={{ display: "flex", gap: "20px" }}>
//         <div>
//           <h4>Local Video</h4>
//           <video ref={localVideoRef} playsInline muted autoPlay width={300} />
//         </div>
//         <div>
//           <h4>Remote Video</h4>
//           <video ref={remoteVideoRef} playsInline autoPlay width={300} />
//         </div>
//       </div>
//     </div>
//   );
// }
// App.jsx
// App.jsx
import React, { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import "./App.css"; // Assuming you have some basic CSS
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  transports: ["websocket"],
});

export default function App() {
  const [myPeerId, setMyPeerId] = useState("");
  const [availablePeers, setAvailablePeers] = useState([]); // Stores peer IDs discovered from server
  const [callingToId, setCallingToId] = useState(null); // The ID we are currently trying to call

  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null); // To store the local media stream

  useEffect(() => {
    // 1. Initialize PeerJS
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      console.log("My Peer ID:", id);
      setMyPeerId(id);
      socket.emit("peerId", id); // Register my Peer ID with the signaling server
    });

    // 2. Listen for incoming calls
    peer.on("call", async (call) => {
      console.log("Incoming call from:", call.peer);
      // Prompt user to accept/reject call (optional, but good practice)
      const acceptCall = window.confirm(
        `Incoming call from ${call.peer}. Do you want to accept?`
      );

      if (acceptCall) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          localStreamRef.current = stream;
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play();

          call.answer(stream); // Answer with your stream

          call.on("stream", (remoteStream) => {
            console.log("Receiving remote stream from incoming call.");
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play();
          });

          call.on("close", () => {
            console.log("Incoming call ended.");
            cleanupStreamsAndVideos();
          });

          call.on("error", (err) => {
            console.error("Incoming call error:", err);
            cleanupStreamsAndVideos();
          });
        } catch (err) {
          console.error("Error accessing media for incoming call:", err);
          alert("Could not access camera/microphone to answer the call.");
        }
      } else {
        console.log("Call rejected.");
        call.close(); // Decline the call
      }
    });

    peer.on("error", (err) => {
      console.error("PeerJS error:", err);
    });

    // 3. Listen for other available peers from the signaling server
    socket.on("peerIdAvailable", (id) => {
      // Add a new peer ID to the list if it's not our own
      if (id !== myPeerId && !availablePeers.includes(id)) {
        setAvailablePeers((prevPeers) => [...prevPeers, id]);
        console.log("New peer available:", id);
      }
    });

    // 4. Listen for a list of active peers from the server (on initial connect)
    socket.on("activePeerIds", (ids) => {
      // Filter out our own ID and update the list
      const filteredIds = ids.filter((id) => id !== myPeerId);
      setAvailablePeers(filteredIds);
      console.log("Initial active peers:", filteredIds);
    });

    // 5. Listen for peers disconnecting
    socket.on("peerIdUnavailable", (id) => {
      setAvailablePeers((prevPeers) => prevPeers.filter((peer) => peer !== id));
      console.log("Peer disconnected:", id);
      // If the disconnected peer was the one we were calling, reset call state
      if (callingToId === id) {
        setCallingToId(null);
        cleanupStreamsAndVideos();
        alert(`The peer ${id} you were connected to has disconnected.`);
      }
    });

    // Cleanup function for useEffect
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      socket.off("peerIdAvailable");
      socket.off("activePeerIds");
      socket.off("peerIdUnavailable");
      cleanupStreamsAndVideos();
    };
  }, []); // Dependencies for useEffect

  // Helper function to stop tracks and clear video elements
  const cleanupStreamsAndVideos = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  // Function to initiate a call
  const startCall = async (remotePeerId) => {
    if (!remotePeerId || remotePeerId === myPeerId) {
      alert("Invalid Peer ID to call or trying to call yourself.");
      return;
    }

    setCallingToId(remotePeerId); // Indicate who we are calling

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play(); // Play local video immediately

      const call = peerRef.current.call(remotePeerId, stream);
      console.log("Initiating call to:", remotePeerId);

      call.on("stream", (remoteStream) => {
        console.log("Receiving remote stream after initiating call.");
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play();
      });

      call.on("close", () => {
        console.log("Outgoing call ended.");
        cleanupStreamsAndVideos();
        setCallingToId(null);
      });

      call.on("error", (err) => {
        console.error("Outgoing call error:", err);
        cleanupStreamsAndVideos();
        setCallingToId(null);
        alert(`Call to ${remotePeerId} failed: ${err.message}`);
      });
    } catch (err) {
      console.error("Failed to access media or make call:", err);
      alert(
        "Failed to access camera/microphone or make call. Check console for details."
      );
      setCallingToId(null);
      cleanupStreamsAndVideos();
    }
  };

  // Function to hang up
  const hangUp = () => {
    console.log("Hanging up...");
    // PeerJS automatically closes the call when the connection is destroyed
    // or when the other peer closes. For explicit hangup, you'd manage call objects.
    // For simplicity here, we'll just clean up streams and videos.
    cleanupStreamsAndVideos();
    setCallingToId(null);
    if (peerRef.current) {
      // A more robust hangup would involve closing the specific 'call' object
      // if you stored it. For now, cleaning up streams is sufficient to end visuals.
      // If you only have one call at a time, creating a 'currentCallRef' might be useful.
    }
  };

  return (
    <div className="App">
      <h1>Automated Video Call 📞</h1>
      <hr />
      <h3>
        My Peer ID:{" "}
        <span style={{ color: "blue" }}>{myPeerId || "Connecting..."}</span>
      </h3>
      <p>
        Share this ID with someone to let them call you, or choose from
        available peers below.
      </p>
      <hr />

      {availablePeers.length > 0 ? (
        <div>
          <h4>Available Peers to Call:</h4>
          <ul>
            {availablePeers.map((peerId) => (
              <li key={peerId}>
                {peerId}
                <button
                  onClick={() => startCall(peerId)}
                  disabled={!!callingToId} // Disable if already calling
                  style={{ marginLeft: "10px" }}
                >
                  {callingToId === peerId ? "Calling..." : "Call Now"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>
          No other peers online yet. Open another tab or wait for someone to
          join.
        </p>
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

      <hr />

      <div
        className="video-parent"
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
            playsInline
            muted
            autoPlay
            width={300}
            style={{ border: "1px solid gray", background: "#f0f0f0" }}
          />
        </div>
        <div>
          <h4>Remote Video 🗣️</h4>
          <video
            ref={remoteVideoRef}
            playsInline
            autoPlay
            width={300}
            style={{ border: "1px solid gray", background: "#f0f0f0" }}
          />
        </div>
      </div>
    </div>
  );
}
