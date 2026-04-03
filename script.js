let provider;
let signer;
let contract;


const contractAddress = "0x41b8D9d2fa5D7688f1ca1376Bd8C5b505Dfc8668";
const abi = [
	{
		"inputs": [],
		"name": "confirmDelivery",
		"outputs": [],
		"stateMutability": "nonpayable",
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
		"name": "refund",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
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
    if (!contract) {
      alert("Please connect wallet first!");
      return;
    }

    const tx = await contract.deposit({
      value: ethers.utils.parseEther("0.01")
    });

    console.log("Transaction sent:", tx);

    await tx.wait();

    document.getElementById("status").innerText = "Deposited!";
  } catch (err) {
    console.error("Deposit error:", err);
    alert("Deposit failed — check console");
  }
}
document.getElementById("depositBtn").disabled = true;