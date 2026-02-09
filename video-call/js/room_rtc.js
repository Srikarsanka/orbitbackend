// Your Agora App ID
const APP_ID = "5f9331a82e8546b393ad525126a79d86";

// Generate a unique UID for each tab
let uid = String(Date.now()) + String(Math.floor(Math.random() * 10000));

// Token (null for testing)
let token = null;

// Agora client instance
let client;

// Extract room ID
const urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get("room") || "main";

// Local media tracks
let localTracks = [];

// Remote users map
let remoteUsers = {};

// ===============================================
// Join Room
// ===============================================
let joinRoomInit = async () => {
  try {
    client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

    if (client && client.leave) {
      await client.leave();
    }

    console.log(`Joining room ${roomId} with UID: ${uid}`);

    await client.join(APP_ID, roomId, token, uid);

    // Agora event listeners
    client.on("user-published", handleUserPublished);
    client.on("user-left", handleUserLeft);

    // 👉 Added for remote camera off placeholder
    client.on("userMuteVideo", handleRemoteMuteVideo);

    await joinStream();
  } catch (error) {
    console.error("Failed to join room:", error);
  }
};

// ===============================================
// Create Local Stream + Local Video Container
// ===============================================
let joinStream = async () => {
  try {
    const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
      {},
      {
        encoderConfig: { width: { min: 640, ideal: 1920, max: 1920 } },
        height: { min: 480, ideal: 1080, max: 1080 },
      }
    );

    localTracks = [micTrack, camTrack];

    // Create Local User Container
    const videoContainer = document.createElement("div");
    videoContainer.className = "video__containers";
    videoContainer.id = `user-container-${uid}`;

    videoContainer.innerHTML = `
        <div class="video-box">
            <video id="user-${uid}" autoplay playsinline></video>
        </div>

        <!-- Placeholder when camera off -->
        <div class="video-placeholder" id="placeholder-${uid}">
            <img src="https://res.cloudinary.com/dnevq4wek/image/upload/v1763464407/download-removebg-preview_xqe3wf.png" class="placeholder-img"/>
            <div class="placeholder-name">You </div>
        </div>
    `;

    document.getElementById("streams_container").appendChild(videoContainer);

    camTrack.play(`user-${uid}`);
    await client.publish(localTracks);

    console.log("Local stream playing...");
  } catch (err) {
    console.error("Stream init error:", err);
  }
};

// ===============================================
// Remote User Published
// ===============================================
let handleUserPublished = async (user, mediaType) => {
  remoteUsers[user.uid] = user;
  await client.subscribe(user, mediaType);

  let player = document.getElementById(`user-container-${user.uid}`);

  if (!player) {
    const videoContainer = document.createElement("div");
    videoContainer.className = "video__containers";
    videoContainer.id = `user-container-${user.uid}`;

    let name = user.name || user.uid;

    videoContainer.innerHTML = `
        <div class="video-box">
            <video id="user-${user.uid}" autoplay playsinline></video>
        </div>

        <!-- placeholder for remote users -->
        <div class="video-placeholder" id="placeholder-${user.uid}">
            <img src="./images/default-user.png" class="placeholder-img"/>
            <div class="placeholder-name">${name}</div>
        </div>
    `;

    document.getElementById("streams_container").appendChild(videoContainer);
  }

  if (mediaType === "video") {
    user.videoTrack.play(`user-${user.uid}`);
  }
  if (mediaType === "audio") {
    user.audioTrack.play();
  }
};

// ===============================================
// Remote Camera OFF handler
// ===============================================
let handleRemoteMuteVideo = (user, muted) => {
  let container = document.getElementById(`user-container-${user.uid}`);
  if (!container) return;

  let box = container.querySelector(".video-box");
  let placeholder = container.querySelector(".video-placeholder");

  if (muted) {
    box.style.display = "none";
    placeholder.style.display = "flex";
  } else {
    box.style.display = "block";
    placeholder.style.display = "none";
  }
};

// ===============================================
// Handle user leaving
// ===============================================
let handleUserLeft = (user) => {
  delete remoteUsers[user.uid];
  const player = document.getElementById(`user-container-${user.uid}`);
  if (player) player.remove();
};

// Cleanup on unload
window.addEventListener("beforeunload", async () => {
  if (client) await client.leave();

  if (localTracks.length > 0) {
    localTracks.forEach((track) => {
      track.stop();
      track.close();
    });
  }
});

window.addEventListener("DOMContentLoaded", joinRoomInit);
