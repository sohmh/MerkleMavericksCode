/* ═══════════════════════════════════════════════════════════════
   LockChain — script.js
   Contract interaction logic. Landing page logic lives in index.html.
   Do NOT remove or rename: connectWallet, deposit, confirmDelivery, refund
═══════════════════════════════════════════════════════════════ */

let isConnecting = false; // guard against concurrent MetaMask requests
let provider;
let signer;
let contract;

const contractAddress = "0x66AEa4900852D1df76Cc441938b6b40743f0b057";
const abi = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_seller",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_arbiter",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "seller",
				"type": "address"
			}
		],
		"name": "DeliveryConfirmed",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "Deposited",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "Refunded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "enum Escrow.State",
				"name": "newState",
				"type": "uint8"
			}
		],
		"name": "StateChanged",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "arbiter",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "buyer",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "confirmDelivery",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "currentState",
		"outputs": [
			{
				"internalType": "enum Escrow.State",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "deposit",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getBalance",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getState",
		"outputs": [
			{
				"internalType": "enum Escrow.State",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "refund",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "seller",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

const STATE_LABELS = ["Awaiting Payment", "Awaiting Delivery", "Complete", "Refunded"];

/* ─── Network guard ─── */
async function checkNetwork() {
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111) {
    document.getElementById("status").innerText = "Wrong network — please switch MetaMask to Sepolia.";
    return false;
  }
  return true;
}

/* ─── Track / lifecycle UI ─── */
function updateTrack(state) {
  [0, 1, 2, 3].forEach(i => {
    const s  = document.getElementById('s'  + i);
    const sl = document.getElementById('sl' + i);
    s.className  = 'step' + (i < state ? ' done' : i === state ? ' active' : '');
    if (sl) sl.className = 'step-line' + (i < state ? ' done' : '');
  });
}

/* ─── TX log ─── */
function addLog(message) {
  const log = document.getElementById("txLog");
  const empty = log.querySelector('.log-empty');
  if (empty) empty.remove();
  const time = new Date().toLocaleTimeString();
  log.insertAdjacentHTML('afterbegin',
    `<div class="log-entry"><span class="log-time">${time}</span><span class="log-msg">${message}</span></div>`
  );
}

/* ─── Legacy logTx (kept for compatibility) ─── */
function logTx(message) {
  addLog(message);
}

/* ─── Error handler ─── */
function handleError(err) {
  const msg = err?.reason || err?.message || "";
  const revertMap = {
    "Only buyer allowed":   "Switch to the Buyer account in MetaMask.",
    "Only arbiter allowed": "Switch to the Arbiter account in MetaMask.",
    "Already paid":         "Funds are already held in escrow.",
    "Not ready":            "Awaiting deposit before confirming delivery.",
    "Cannot refund":        "No funds in escrow to refund."
  };
  const match = Object.entries(revertMap).find(([k]) => msg.includes(k));
  return match ? match[1] : "Transaction failed — check MetaMask.";
}

/* ─── Load live contract data ─── */
async function loadContractData() {
  try {
    const bal   = await contract.getBalance();
    const state = await contract.getState();
    document.getElementById("balance").innerText =
      parseFloat(ethers.utils.formatEther(bal)).toFixed(4) + " ETH";
    document.getElementById("status").innerText = STATE_LABELS[state];
    updateTrack(state);
  } catch (e) {
    console.warn("loadContractData error:", e);
  }
}

/* ─── Attach contract event listeners ─── */
function attachContractEvents() {
  contract.on("StateChanged", async (newState) => {
    document.getElementById("status").innerText = STATE_LABELS[newState];
    updateTrack(newState);
    const bal = await contract.getBalance();
    document.getElementById("balance").innerText =
      parseFloat(ethers.utils.formatEther(bal)).toFixed(4) + " ETH";
  });

  contract.on("Deposited", (buyer, amount) => {
    addLog("Deposit — " + ethers.utils.formatEther(amount) + " ETH locked in escrow");
  });

  contract.on("DeliveryConfirmed", (buyer, seller) => {
    addLog("Delivery confirmed — ETH released to seller");
  });

  contract.on("Refunded", (buyer, amount) => {
    addLog("Refund issued — " + ethers.utils.formatEther(amount) + " ETH returned to buyer");
  });
}

/* ─── Connect Wallet  (called from landing page step 2) ─── */
async function connectWallet() {
  // Prevent duplicate / concurrent MetaMask requests
  if (isConnecting) return;
  isConnecting = true;

  const statusEl = document.getElementById("connectStatus");
  const btn      = document.getElementById("btnMetaMask");

  if (!window.ethereum) {
    if (statusEl) { statusEl.className = "connect-status error"; statusEl.textContent = "MetaMask not found. Please install it first."; }
    isConnecting = false;
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = "<span>🦊</span> Connecting…"; }
  if (statusEl) { statusEl.className = "connect-status"; statusEl.textContent = "Checking wallet…"; }

  try {
    // ── Use eth_accounts first (silent, no popup) ──
    // Only call eth_requestAccounts (which triggers the MetaMask popup) if
    // the user hasn't already granted permission to this origin.
    let accounts = await ethereum.request({ method: "eth_accounts" });

    if (!accounts || accounts.length === 0) {
      if (statusEl) statusEl.textContent = "Waiting for MetaMask approval…";
      // This opens the MetaMask popup exactly once
      await ethereum.request({ method: "eth_requestAccounts" });
      accounts = await ethereum.request({ method: "eth_accounts" });
    }

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found after approval.");
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer   = provider.getSigner();

    if (!await checkNetwork()) {
      if (btn) { btn.disabled = false; btn.innerHTML = "<span>🦊</span> Connect with MetaMask"; }
      if (statusEl) { statusEl.className = "connect-status error"; statusEl.textContent = "Wrong network — switch to Sepolia in MetaMask."; }
      return;
    }

    contract = new ethers.Contract(contractAddress, abi, signer);

    const walletAddress = accounts[0];

    // Persist session
    localStorage.setItem("escrow_role",   selectedRole);
    localStorage.setItem("escrow_wallet", walletAddress);

    if (statusEl) { statusEl.className = "connect-status success"; statusEl.textContent = "Wallet connected! Loading app…"; }

    // Small delay so user sees the success state
    await new Promise(r => setTimeout(r, 500));

    // Transition to main app
    showApp(walletAddress);

    // Load live data
    await loadContractData();
    attachContractEvents();

  } catch (err) {
    console.error("connectWallet error:", err);
    const msg = err?.message || "Connection failed";
    const friendly = msg.includes("already pending")
      ? "MetaMask popup already open — please check MetaMask."
      : msg.includes("rejected") || msg.includes("denied")
      ? "Connection rejected by user."
      : "Error: " + msg;
    if (statusEl) { statusEl.className = "connect-status error"; statusEl.textContent = friendly; }
  } finally {
    isConnecting = false;
    if (btn) { btn.disabled = false; btn.innerHTML = "<span>🦊</span> Connect with MetaMask"; }
  }
}

/* ─── Deposit ─── */
async function deposit() {
  const btn = document.getElementById("depositBtn");
  btn.disabled = true;
  const network = document.getElementById("networkSelect").value;
  btn.innerText = network === "eth" ? "Processing…" : "Deposit (Algorand)";
  try {
    if (network === "eth") {
      const tx = await contract.deposit({ value: ethers.utils.parseEther("0.01") });
      await tx.wait();
      logTx("Deposit successful: " + tx.hash);
      document.getElementById("status").innerText = "Deposited on Ethereum!";
      addLog("Deposit confirmed — <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>view on Etherscan</a>");
      document.getElementById("txLink").innerHTML =
        "Latest tx: <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>" + tx.hash.slice(0, 12) + "...</a>";
    } else {
      alert("Algorand escrow coming soon 🚀");
      document.getElementById("status").innerText = "Algorand mode (demo)";
    }
  } catch (err) {
    console.error("Deposit error:", err);
    document.getElementById("status").innerText = handleError(err);
  } finally {
    btn.disabled = false;
    btn.innerText = "Deposit 0.01 ETH";
  }
}

/* ─── Confirm Delivery ─── */
async function confirmDelivery() {
  const btn = document.getElementById("confirmBtn");
  btn.disabled = true;
  btn.innerText = "Processing…";
  try {
    const tx = await contract.confirmDelivery();
    await tx.wait();
    logTx("Confirmed: " + tx.hash);
    document.getElementById("status").innerText = "Delivery Confirmed!";
    addLog("Delivery confirmed — <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>view on Etherscan</a>");
    document.getElementById("txLink").innerHTML =
      "Latest tx: <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>" + tx.hash.slice(0, 12) + "...</a>";
  } catch (err) {
    console.error("Confirm error:", err);
    document.getElementById("status").innerText = handleError(err);
  } finally {
    btn.disabled = false;
    btn.innerText = "Confirm Delivery";
  }
}

/* ─── Refund ─── */
async function refund() {
  const btn = document.getElementById("refundBtn");
  btn.disabled = true;
  btn.innerText = "Processing…";
  try {
    document.getElementById("status").innerText = "Processing refund…";
    const tx = await contract.refund();
    await tx.wait();
    logTx("Refund issued to buyer");
    document.getElementById("status").innerText = "Refunded!";
    addLog("Refund issued — <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>view on Etherscan</a>");
    document.getElementById("txLink").innerHTML =
      "Latest tx: <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>" + tx.hash.slice(0, 12) + "...</a>";
  } catch (err) {
    console.error("Refund error:", err);
    document.getElementById("status").innerText = handleError(err);
  } finally {
    btn.disabled = false;
    btn.innerText = "Issue Refund";
  }
}

/* ─── Balance helper ─── */
async function updateBalance() {
  const balance = await provider.getBalance(contractAddress);
  const eth = ethers.utils.formatEther(balance);
  document.getElementById("balance").innerText = parseFloat(eth).toFixed(4) + " ETH";
}