let provider;
let signer;
let contract;


const contractAddress = "0x348417DC1DD70F84bD21CB972D3Dd2E188d657B4";
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

    contract = new ethers.Contract(contractAddress, abi, signer);

    const accounts = await provider.listAccounts();
    console.log("Accounts:", accounts);

    document.getElementById("status").innerText =
    "Wallet Connected: " + accounts[0];

    document.getElementById("depositBtn").disabled = false;
  }
}

async function deposit() {
  try {
    document.getElementById("status").innerText = "Processing deposit...";

    const tx = await contract.deposit({
      value: ethers.utils.parseEther("0.01")
    });

    await tx.wait();

    document.getElementById("status").innerText = "Deposited!";
  } catch (err) {
    console.error("Deposit error:", err);
    alert("Deposit failed — check console");
  }
}
document.getElementById("confirmBtn").disabled = false;

async function confirmDelivery() {
  try {
    const tx = await contract.confirmDelivery();
    console.log("Confirm tx:", tx);

    await tx.wait();

    document.getElementById("status").innerText = "Delivery Confirmed!";
  } catch (err) {
    console.error("Confirm error:", err);
    alert("Confirm failed — check console");
  }
}