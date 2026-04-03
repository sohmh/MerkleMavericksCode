let provider;
let signer;
let contract;


const contractAddress = "0x47d616E2C6987C91871CC618b69523E6d9dca041";
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

async function connectWallet(){
  console.log("Connect clicked");
  console.log("CONNECT FUNCTION CALLED");

  if (window.ethereum) {
    await ethereum.request({ method: "eth_requestAccounts" });

    console.log("Accounts requested");

    provider = new ethers.providers.Web3Provider(window.ethereum);
    signer = provider.getSigner();
    if (!await checkNetwork()) return;
    contract = new ethers.Contract(contractAddress, abi, signer);

    const accounts = await provider.listAccounts();
    console.log("Accounts:", accounts);

    document.getElementById("status").innerText =
    "Wallet Connected: " + accounts[0];
    // Role detection
const BUYER   = "0x3A59180d32A359B3f7850a4a7A78735D582fb05A".toLowerCase();
const SELLER  = "0xbC85608273Af085fef7352F520f49ea55BB9068E".toLowerCase();
const ARBITER = "0x308e62B49fFcfA564942813Ed2629eCd5F0dE0bB".toLowerCase();

const addr = accounts[0].toLowerCase();
let role = "Observer";
if (addr === BUYER)   role = "Buyer";
if (addr === SELLER)  role = "Seller";
if (addr === ARBITER) role = "Arbiter";

document.getElementById("role-badge").innerText = "Connected as: " + role;

// Show/hide buttons based on role
document.getElementById("depositBtn").style.display  = (role === "Buyer")   ? "inline" : "none";
document.getElementById("confirmBtn").style.display  = (role === "Buyer")   ? "inline" : "none";
document.getElementById("refundBtn").style.display   = (role === "Arbiter") ? "inline" : "none";

// Live balance
const bal = await contract.getBalance();
document.getElementById("balance").innerText =
  "Escrow holds: " + ethers.utils.formatEther(bal) + " ETH";
  // ← PASTE EVENT LISTENERS HERE
    contract.on("StateChanged", async (newState) => {
      const labels = ["Awaiting Payment", "Awaiting Delivery", "Complete", "Refunded"];
      document.getElementById("status").innerText = "State: " + labels[newState];
      const bal = await contract.getBalance();
      document.getElementById("balance").innerText =
        "Escrow holds: " + ethers.utils.formatEther(bal) + " ETH";
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

    document.getElementById("depositBtn").disabled = false;
  }
}

async function deposit() {
  const btn = document.getElementById("depositBtn");
  btn.disabled = true;
  const network = document.getElementById("networkSelect").value;
  btn.innerText = network === "eth" ? "Processing..." : "Deposit (Algorand)";
  try {
    if (network === "eth") {
      const tx = await contract.deposit({ value: ethers.utils.parseEther("0.01") });
      await tx.wait();
      document.getElementById("status").innerText = "Deposited on Ethereum!";
      addLog("Deposit confirmed — <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>view on Etherscan</a>");
      document.getElementById("txLink").innerHTML = "Latest tx: <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>" + tx.hash.slice(0,12) + "...</a>";
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


async function confirmDelivery() {
  const btn = document.getElementById("confirmBtn");
  btn.disabled = true;
  btn.innerText = "Processing...";
  try {
    const tx = await contract.confirmDelivery();
    await tx.wait();
    document.getElementById("status").innerText = "Delivery Confirmed!";
    addLog("Delivery confirmed — <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>view on Etherscan</a>");
    document.getElementById("txLink").innerHTML = "Latest tx: <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>" + tx.hash.slice(0,12) + "...</a>";
  } catch (err) {
    console.error("Confirm error:", err);
    document.getElementById("status").innerText = handleError(err);
  } finally {
    btn.disabled = false;
    btn.innerText = "Confirm Delivery";
  }
}

async function refund() {
  const btn = document.getElementById("refundBtn");
  btn.disabled = true;
  btn.innerText = "Processing...";
  try {
    document.getElementById("status").innerText = "Processing refund...";
    const tx = await contract.refund();
    await tx.wait();
    document.getElementById("status").innerText = "Refunded!";
    addLog("Refund issued — <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>view on Etherscan</a>");
    document.getElementById("txLink").innerHTML = "Latest tx: <a href='https://sepolia.etherscan.io/tx/" + tx.hash + "' target='_blank'>" + tx.hash.slice(0,12) + "...</a>";
  } catch (err) {
    console.error("Refund error:", err);
    document.getElementById("status").innerText = handleError(err);
  } finally {
    btn.disabled = false;
    btn.innerText = "Issue Refund (Arbiter)";
  }
}

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

async function checkNetwork() {
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111) {
    document.getElementById("status").innerText =
      "Wrong network — please switch MetaMask to Sepolia.";
    return false;
  }
  return true;
}

function addLog(message) {
  const log = document.getElementById("txLog");
  const time = new Date().toLocaleTimeString();
  log.innerHTML = `<li>${time} — ${message}</li>` + log.innerHTML;
}