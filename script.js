/* ═══════════════════════════════════════════════════════════════
   LockChain — script.js  (v2 — Factory + Firebase lobby)
   
   NEW FLOW:
     Buyer  → creates room in Firebase → gets shareable link
     Seller / Arbiter → open link → join room
     When all 3 slots filled → Buyer calls EscrowFactory.createEscrow()
     Everyone is redirected to their live escrow dashboard
═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   CONFIGURATION  — fill these in before deploying
───────────────────────────────────────────────────────────────
   1. Deploy EscrowFactory.sol to Sepolia → paste address below
   2. Create a free Firebase project → paste your firebaseConfig below
      (Realtime Database, rules: authenticated read/write or open for hackathon)
───────────────────────────────────────────────────────────────*/
const FACTORY_ADDRESS = "0x34BFb985eF2E051134D83149BB9700f3089526Bf";

// Firebase config — replace with yours from the Firebase console
const firebaseConfig = {
  apiKey:            "AIzaSyAgWROSyc3AXROEY08mCHl3ps6HMFXKUuE",
  authDomain:        "lockchain-257smv.firebaseapp.com",
  databaseURL:       "https://lockchain-257smv-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "lockchain-257smv",
  storageBucket:     "lockchain-257smv.firebasestorage.app",
  messagingSenderId: "960742810909",
  appId:             "1:960742810909:web:bd913d1c4979c3b6d66df4"
};

/* ─────────────────────────────────────────────────────────────
   ABI — EscrowFactory (only what the frontend needs)
─────────────────────────────────────────────────────────────*/
const FACTORY_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_seller",  "type": "address" },
      { "internalType": "address", "name": "_arbiter", "type": "address" }
    ],
    "name": "createEscrow",
    "outputs": [{ "internalType": "address", "name": "escrowAddress", "type": "address" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "address", "name": "escrowAddress", "type": "address" },
      { "indexed": true,  "internalType": "address", "name": "buyer",         "type": "address" },
      { "indexed": true,  "internalType": "address", "name": "seller",        "type": "address" },
      { "indexed": false, "internalType": "address", "name": "arbiter",       "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp",     "type": "uint256" }
    ],
    "name": "EscrowCreated",
    "type": "event"
  }
];

/* ─────────────────────────────────────────────────────────────
   ABI — Individual Escrow (the child contract)
─────────────────────────────────────────────────────────────*/
const ESCROW_ABI = [
  { "inputs": [], "name": "buyer",   "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "seller",  "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "arbiter", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "deposit",         "outputs": [], "stateMutability": "payable",  "type": "function" },
  { "inputs": [], "name": "confirmDelivery", "outputs": [], "stateMutability": "nonpayable","type": "function" },
  { "inputs": [], "name": "refund",          "outputs": [], "stateMutability": "nonpayable","type": "function" },
  { "inputs": [], "name": "getBalance",      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getState",        "outputs": [{ "internalType": "uint8",   "name": "", "type": "uint8"   }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "currentState",    "outputs": [{ "internalType": "uint8",   "name": "", "type": "uint8"   }], "stateMutability": "view", "type": "function" },
  {
    "anonymous": false,
    "inputs": [{ "indexed": false, "internalType": "uint8", "name": "newState", "type": "uint8" }],
    "name": "StateChanged", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "buyer",  "type": "address" },
      { "indexed": false,"internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "Deposited", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "buyer",  "type": "address" },
      { "indexed": true, "internalType": "address", "name": "seller", "type": "address" }
    ],
    "name": "DeliveryConfirmed", "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "buyer",  "type": "address" },
      { "indexed": false,"internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "Refunded", "type": "event"
  }
];

/* ─────────────────────────────────────────────────────────────
   STATE
─────────────────────────────────────────────────────────────*/
let isConnecting  = false;
let provider, signer;
let factoryContract, escrowContract;
let selectedRole  = null;   // 'buyer' | 'seller' | 'arbiter'
let currentRoomId = null;   // Firebase room key
let db            = null;   // Firebase Database instance
let roomListener  = null;   // active Firebase listener unsubscribe fn

const STATE_LABELS = ["Awaiting Payment", "Awaiting Delivery", "Complete", "Refunded"];

/* ─────────────────────────────────────────────────────────────
   FIREBASE INIT  (called once from DOMContentLoaded)
─────────────────────────────────────────────────────────────*/
function initFirebase() {
  // Firebase v9 compat (loaded via CDN in index.html)
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
}

/* ─────────────────────────────────────────────────────────────
   ROOM HELPERS
─────────────────────────────────────────────────────────────*/
function generateRoomId() {
  return Math.random().toString(36).slice(2, 9).toUpperCase(); // e.g. "X3K9P2A"
}

function getRoomFromUrl() {
  return new URLSearchParams(window.location.search).get("room");
}

function buildShareableLink(roomId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?room=${roomId}`;
}

/**
 * Create a new lobby room in Firebase (called by Buyer after connecting wallet).
 * Returns the room ID.
 */
async function createRoom(buyerAddress) {
  const roomId = generateRoomId();
  const roomRef = db.ref(`rooms/${roomId}`);
  await roomRef.set({
    createdAt: Date.now(),
    status: "waiting",           // waiting | ready | deployed
    buyer:   buyerAddress,
    seller:  null,
    arbiter: null,
    escrowAddress: null
  });
  return roomId;
}

/**
 * Join an existing room as seller or arbiter.
 */
async function joinRoom(roomId, role, walletAddress) {
  const roomRef = db.ref(`rooms/${roomId}`);
  const snap    = await roomRef.once("value");
  if (!snap.exists()) throw new Error("Room not found. Check the link.");

  const room = snap.val();
  if (room.status === "deployed") throw new Error("This escrow is already active.");
  if (room[role] && room[role] !== walletAddress) {
    throw new Error(`The ${role} slot is already taken by another wallet.`);
  }

  await roomRef.update({ [role]: walletAddress });
}

/**
 * Watch the room for changes. Calls callback(roomData) on every update.
 * Returns an unsubscribe function.
 */
function watchRoom(roomId, callback) {
  const roomRef = db.ref(`rooms/${roomId}`);
  const handler = (snap) => { if (snap.exists()) callback(snap.val()); };
  roomRef.on("value", handler);
  return () => roomRef.off("value", handler);
}

/**
 * Once all three addresses are present, mark room as ready.
 */
async function markRoomReady(roomId) {
  await db.ref(`rooms/${roomId}`).update({ status: "ready" });
}

/**
 * After factory deploys, store the escrow address in Firebase so
 * seller + arbiter can load their dashboard without another MetaMask call.
 */
async function saveEscrowToRoom(roomId, escrowAddress) {
  await db.ref(`rooms/${roomId}`).update({
    status: "deployed",
    escrowAddress
  });
}

/* ─────────────────────────────────────────────────────────────
   NETWORK GUARD
─────────────────────────────────────────────────────────────*/
async function checkNetwork() {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 11155111) {
    setStatus("Wrong network — please switch MetaMask to Sepolia.");
    return false;
  }
  return true;
}

/* ─────────────────────────────────────────────────────────────
   CONNECT WALLET  (called from landing page step 2)
─────────────────────────────────────────────────────────────*/
async function connectWallet() {
  if (isConnecting) return;
  isConnecting = true;

  const statusEl = document.getElementById("connectStatus");
  const btn      = document.getElementById("btnMetaMask");

  if (!window.ethereum) {
    _setConnectStatus("error", "MetaMask not found. Please install it first.");
    isConnecting = false;
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = "<span>🦊</span> Connecting…"; }
  _setConnectStatus("", "Checking wallet…");

  try {
    let accounts = await ethereum.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) {
      _setConnectStatus("", "Waiting for MetaMask approval…");
      await ethereum.request({ method: "eth_requestAccounts" });
      accounts = await ethereum.request({ method: "eth_accounts" });
    }
    if (!accounts || accounts.length === 0) throw new Error("No accounts found.");

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer   = provider.getSigner();

    if (!await checkNetwork()) {
      _setConnectStatus("error", "Wrong network — switch to Sepolia in MetaMask.");
      return;
    }

    factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
    const walletAddress = accounts[0];

    _setConnectStatus("success", "Wallet connected! Setting up lobby…");
    await new Promise(r => setTimeout(r, 400));

    // ── Role-specific lobby logic ──
    await handleLobbyAfterConnect(walletAddress);

  } catch (err) {
    console.error("connectWallet error:", err);
    const msg = err?.message || "";
    const friendly = msg.includes("already pending") ? "MetaMask popup already open — check MetaMask."
                   : msg.includes("rejected") || msg.includes("denied") ? "Connection rejected."
                   : "Error: " + msg;
    _setConnectStatus("error", friendly);
  } finally {
    isConnecting = false;
    if (btn) { btn.disabled = false; btn.innerHTML = "<span>🦊</span> Connect with MetaMask"; }
  }
}

/* ─────────────────────────────────────────────────────────────
   LOBBY LOGIC POST-CONNECT
─────────────────────────────────────────────────────────────*/
async function handleLobbyAfterConnect(walletAddress) {
  const urlRoomId = getRoomFromUrl();

  if (selectedRole === "buyer") {
    if (urlRoomId) {
      // Buyer re-joining their own room
      currentRoomId = urlRoomId;
    } else {
      // Buyer creates a fresh room
      currentRoomId = await createRoom(walletAddress);
      // Update URL without reload so the link is shareable
      window.history.replaceState({}, "", buildShareableLink(currentRoomId));
    }
    // Persist session
    localStorage.setItem("escrow_role",   selectedRole);
    localStorage.setItem("escrow_wallet", walletAddress);
    localStorage.setItem("escrow_room",   currentRoomId);

    showLobbyWaiting(walletAddress, currentRoomId);
    startWatchingRoom(currentRoomId, walletAddress);

  } else {
    // Seller or Arbiter must have a room ID in the URL
    if (!urlRoomId) {
      _setConnectStatus("error", "No room link found. Ask the Buyer to share the link.");
      return;
    }
    currentRoomId = urlRoomId;
    try {
      await joinRoom(currentRoomId, selectedRole, walletAddress);
    } catch (e) {
      _setConnectStatus("error", e.message);
      return;
    }

    localStorage.setItem("escrow_role",   selectedRole);
    localStorage.setItem("escrow_wallet", walletAddress);
    localStorage.setItem("escrow_room",   currentRoomId);

    showLobbyWaiting(walletAddress, currentRoomId);
    startWatchingRoom(currentRoomId, walletAddress);
  }
}

/* ─────────────────────────────────────────────────────────────
   LOBBY WAITING SCREEN  (shown to all three before deployment)
─────────────────────────────────────────────────────────────*/
function showLobbyWaiting(walletAddress, roomId) {
  // Hide landing, show lobby overlay
  document.getElementById("landing").classList.add("hide");
  document.getElementById("lobby").classList.add("visible");

  const short = walletAddress.slice(0,6) + "…" + walletAddress.slice(-4);
  document.getElementById("lobbyYourWallet").textContent = short;
  document.getElementById("lobbyRoomId").textContent     = roomId;

  const link = buildShareableLink(roomId);
  document.getElementById("lobbyShareLink").value = link;

  // Only buyer sees the "share this link" instruction prominently
  document.getElementById("lobbyShareSection").style.display =
    selectedRole === "buyer" ? "block" : "none";
}

function updateLobbySlots(room) {
  const slots = ["buyer","seller","arbiter"];
  slots.forEach(role => {
    const el = document.getElementById("lobbySlot-" + role);
    if (!el) return;
    if (room[role]) {
      const addr = room[role];
      el.innerHTML = `<span class="slot-filled">✓ ${addr.slice(0,6)}…${addr.slice(-4)}</span>`;
    } else {
      el.innerHTML = `<span class="slot-empty">Waiting…</span>`;
    }
  });

  const allFilled = slots.every(r => room[r]);
  const deployBtn = document.getElementById("lobbyDeployBtn");
  if (deployBtn) deployBtn.disabled = !allFilled || selectedRole !== "buyer";

  const lobbyStatus = document.getElementById("lobbyStatus");
  if (room.status === "deployed") {
    if (lobbyStatus) lobbyStatus.textContent = "Escrow deployed! Loading dashboard…";
  } else if (allFilled) {
    if (lobbyStatus) lobbyStatus.textContent = selectedRole === "buyer"
      ? "All participants joined — deploy the escrow contract!"
      : "All participants joined — waiting for Buyer to deploy…";
  } else {
    const filled = slots.filter(r => room[r]).length;
    if (lobbyStatus) lobbyStatus.textContent = `${filled}/3 participants joined`;
  }
}

function startWatchingRoom(roomId, walletAddress) {
  if (roomListener) roomListener(); // unsubscribe previous
  roomListener = watchRoom(roomId, async (room) => {
    updateLobbySlots(room);

    // When escrow is deployed, everyone loads the dashboard
    if (room.status === "deployed" && room.escrowAddress) {
      if (roomListener) { roomListener(); roomListener = null; }
      await loadEscrowDashboard(room.escrowAddress, walletAddress);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   DEPLOY ESCROW  (Buyer only — called from lobby "Deploy" button)
─────────────────────────────────────────────────────────────*/
async function deployEscrow() {
  const btn = document.getElementById("lobbyDeployBtn");
  btn.disabled = true;
  btn.textContent = "Deploying…";

  try {
    const snap = await db.ref(`rooms/${currentRoomId}`).once("value");
    const room = snap.val();
    if (!room.seller || !room.arbiter) throw new Error("Waiting for seller/arbiter to join.");

    document.getElementById("lobbyStatus").textContent = "Sending transaction — confirm in MetaMask…";

    const tx = await factoryContract.createEscrow(room.seller, room.arbiter);
    document.getElementById("lobbyStatus").textContent = "Transaction sent — waiting for confirmation…";
    const receipt = await tx.wait();

    // Parse EscrowCreated event to get new contract address
    const iface = new ethers.utils.Interface(FACTORY_ABI);
    let escrowAddress = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === "EscrowCreated") {
          escrowAddress = parsed.args.escrowAddress;
          break;
        }
      } catch (_) {}
    }
    if (!escrowAddress) throw new Error("Could not read new escrow address from tx logs.");

    // Save to Firebase → triggers all watchers
    await saveEscrowToRoom(currentRoomId, escrowAddress);

  } catch (err) {
    console.error("deployEscrow error:", err);
    document.getElementById("lobbyStatus").textContent = "Deploy failed: " + (err?.reason || err?.message || "unknown error");
    btn.disabled = false;
    btn.textContent = "Deploy Escrow Contract";
  }
}

/* ─────────────────────────────────────────────────────────────
   COPY LINK HELPER
─────────────────────────────────────────────────────────────*/
async function copyShareLink() {
  const input = document.getElementById("lobbyShareLink");
  try {
    await navigator.clipboard.writeText(input.value);
    const btn = document.getElementById("copyLinkBtn");
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = "Copy"; }, 2000);
  } catch (_) {
    input.select();
    document.execCommand("copy");
  }
}

/* ─────────────────────────────────────────────────────────────
   LOAD ESCROW DASHBOARD  (called for all three roles)
─────────────────────────────────────────────────────────────*/
async function loadEscrowDashboard(escrowAddress, walletAddress) {
  escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, signer);

  // Hide lobby, show app
  document.getElementById("lobby").classList.remove("visible");
  document.getElementById("app").classList.add("visible");

  const short = walletAddress.slice(0,6) + "…" + walletAddress.slice(-4);
  document.getElementById("walletDisplay").textContent = short;

  const badge = document.getElementById("role-badge");
  const roleCap = selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);
  badge.textContent = roleCap + ": " + short;
  badge.className   = "role-badge " + selectedRole;

  // Show the right action cards per role
  document.getElementById("depositCard").style.display = selectedRole === "buyer"   ? "flex" : "none";
  document.getElementById("confirmCard").style.display = selectedRole === "buyer"   ? "flex" : "none";
  document.getElementById("refundCard").style.display  = selectedRole === "arbiter" ? "flex" : "none";

  // Show escrow address in topbar
  const escrowShort = escrowAddress.slice(0,8) + "…" + escrowAddress.slice(-6);
  document.getElementById("escrowAddressDisplay").textContent = escrowShort;

  await loadContractData();
  attachContractEvents();
}

/* ─────────────────────────────────────────────────────────────
   CONTRACT DATA + EVENTS
─────────────────────────────────────────────────────────────*/
function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.innerText = msg;
}

function updateTrack(state) {
  [0, 1, 2, 3].forEach(i => {
    const s  = document.getElementById("s"  + i);
    const sl = document.getElementById("sl" + i);
    if (s)  s.className  = "step" + (i < state ? " done" : i === state ? " active" : "");
    if (sl) sl.className = "step-line" + (i < state ? " done" : "");
  });
}

function addLog(message) {
  const log = document.getElementById("txLog");
  const empty = log.querySelector(".log-empty");
  if (empty) empty.remove();
  const time = new Date().toLocaleTimeString();
  log.insertAdjacentHTML("afterbegin",
    `<div class="log-entry"><span class="log-time">${time}</span><span class="log-msg">${message}</span></div>`
  );
}

function handleError(err) {
  const msg = err?.reason || err?.message || "";
  const map = {
    "Only buyer allowed":   "Switch to the Buyer account in MetaMask.",
    "Only arbiter allowed": "Switch to the Arbiter account in MetaMask.",
    "Already paid":         "Funds are already held in escrow.",
    "Not ready":            "Awaiting deposit before confirming.",
    "Cannot refund":        "No funds in escrow to refund."
  };
  const match = Object.entries(map).find(([k]) => msg.includes(k));
  return match ? match[1] : "Transaction failed — check MetaMask.";
}

async function loadContractData() {
  try {
    const bal   = await escrowContract.getBalance();
    const state = await escrowContract.getState();
    document.getElementById("balance").innerText =
      parseFloat(ethers.utils.formatEther(bal)).toFixed(4) + " ETH";
    setStatus(STATE_LABELS[state]);
    updateTrack(Number(state));
  } catch (e) { console.warn("loadContractData:", e); }
}

function attachContractEvents() {
  escrowContract.on("StateChanged", async (newState) => {
    setStatus(STATE_LABELS[newState]);
    updateTrack(Number(newState));
    const bal = await escrowContract.getBalance();
    document.getElementById("balance").innerText =
      parseFloat(ethers.utils.formatEther(bal)).toFixed(4) + " ETH";
  });
  escrowContract.on("Deposited",         (buyer, amount) => addLog("Deposit — " + ethers.utils.formatEther(amount) + " ETH locked"));
  escrowContract.on("DeliveryConfirmed", ()              => addLog("Delivery confirmed — ETH released to seller"));
  escrowContract.on("Refunded",          (buyer, amount) => addLog("Refund — " + ethers.utils.formatEther(amount) + " ETH returned"));
}

/* ─────────────────────────────────────────────────────────────
   ACTIONS: DEPOSIT / CONFIRM / REFUND
─────────────────────────────────────────────────────────────*/
async function deposit() {
  const btn = document.getElementById("depositBtn");
  btn.disabled = true; btn.innerText = "Processing…";
  try {
    const tx = await escrowContract.deposit({ value: ethers.utils.parseEther("0.01") });
    await tx.wait();
    addLog("Deposit confirmed — <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>view on Etherscan</a>");
    document.getElementById("txLink").innerHTML =
      "Latest tx: <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>" + tx.hash.slice(0,12) + "…</a>";
  } catch (err) { setStatus(handleError(err)); }
  finally { btn.disabled = false; btn.innerText = "Deposit 0.01 ETH"; }
}

async function confirmDelivery() {
  const btn = document.getElementById("confirmBtn");
  btn.disabled = true; btn.innerText = "Processing…";
  try {
    const tx = await escrowContract.confirmDelivery();
    await tx.wait();
    addLog("Delivery confirmed — <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>view on Etherscan</a>");
    document.getElementById("txLink").innerHTML =
      "Latest tx: <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>" + tx.hash.slice(0,12) + "…</a>";
  } catch (err) { setStatus(handleError(err)); }
  finally { btn.disabled = false; btn.innerText = "Confirm Delivery"; }
}

async function refund() {
  const btn = document.getElementById("refundBtn");
  btn.disabled = true; btn.innerText = "Processing…";
  try {
    setStatus("Processing refund…");
    const tx = await escrowContract.refund();
    await tx.wait();
    addLog("Refund issued — <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>view on Etherscan</a>");
    document.getElementById("txLink").innerHTML =
      "Latest tx: <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>" + tx.hash.slice(0,12) + "…</a>";
  } catch (err) { setStatus(handleError(err)); }
  finally { btn.disabled = false; btn.innerText = "Issue Refund"; }
}

/* ─────────────────────────────────────────────────────────────
   DISCONNECT
─────────────────────────────────────────────────────────────*/
function disconnectWallet() {
  if (roomListener) { roomListener(); roomListener = null; }
  localStorage.removeItem("escrow_role");
  localStorage.removeItem("escrow_wallet");
  localStorage.removeItem("escrow_room");
  selectedRole    = null;
  currentRoomId   = null;
  escrowContract  = null;
  factoryContract = null;

  // Reset URL
  window.history.replaceState({}, "", window.location.pathname);

  // Reset landing UI
  ["buyer","seller","arbiter"].forEach(r => {
    const btn = document.getElementById("roleBtn-" + r);
    if (btn) { btn.classList.remove("selected"); btn.setAttribute("aria-pressed","false"); }
  });
  const toConnect = document.getElementById("btnToConnect");
  if (toConnect) toConnect.disabled = true;

  const stepConnect = document.getElementById("stepConnect");
  const stepRole    = document.getElementById("stepRole");
  if (stepConnect) stepConnect.classList.remove("active");
  if (stepRole)    stepRole.classList.add("active");

  const pip0 = document.getElementById("pip0");
  const pip1 = document.getElementById("pip1");
  if (pip0) { pip0.classList.add("active"); pip0.classList.remove("done"); }
  if (pip1) pip1.classList.remove("active");

  document.getElementById("connectStatus").textContent = "";
  document.getElementById("connectStatus").className   = "connect-status";

  document.getElementById("app").classList.remove("visible");
  document.getElementById("lobby").classList.remove("visible");
  document.getElementById("landing").classList.remove("hide");
}

/* ─────────────────────────────────────────────────────────────
   SESSION RESTORE  (on page reload)
─────────────────────────────────────────────────────────────*/
window.addEventListener("DOMContentLoaded", () => {
  initFirebase();

  const savedRole   = localStorage.getItem("escrow_role");
  const savedWallet = localStorage.getItem("escrow_wallet");
  const savedRoom   = localStorage.getItem("escrow_room");

  if (savedRole && savedWallet && savedRoom) {
    selectedRole  = savedRole;
    currentRoomId = savedRoom;
    restoreSession(savedRole, savedWallet, savedRoom);
  }
});

async function restoreSession(role, walletAddress, roomId) {
  try {
    if (!window.ethereum) return;
    const accounts = await ethereum.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) {
      localStorage.removeItem("escrow_role");
      localStorage.removeItem("escrow_wallet");
      localStorage.removeItem("escrow_room");
      return;
    }
    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer   = provider.getSigner();
    if (!await checkNetwork()) return;

    factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

    // Check if room already has an escrow deployed
    const snap = await db.ref(`rooms/${roomId}`).once("value");
    if (!snap.exists()) {
      localStorage.removeItem("escrow_role");
      localStorage.removeItem("escrow_wallet");
      localStorage.removeItem("escrow_room");
      return;
    }
    const room = snap.val();
    if (room.status === "deployed" && room.escrowAddress) {
      await loadEscrowDashboard(room.escrowAddress, walletAddress);
    } else {
      // Still in lobby
      showLobbyWaiting(walletAddress, roomId);
      startWatchingRoom(roomId, walletAddress);
      document.getElementById("landing").classList.add("hide");
    }
  } catch (e) {
    console.error("restoreSession error:", e);
    localStorage.removeItem("escrow_role");
    localStorage.removeItem("escrow_wallet");
    localStorage.removeItem("escrow_room");
  }
}

/* ─────────────────────────────────────────────────────────────
   INTERNAL HELPERS
─────────────────────────────────────────────────────────────*/
function _setConnectStatus(type, msg) {
  const el = document.getElementById("connectStatus");
  if (!el) return;
  el.className   = "connect-status" + (type ? " " + type : "");
  el.textContent = msg;
}
