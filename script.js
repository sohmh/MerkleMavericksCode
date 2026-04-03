const APP_ID = 758208257; // Replace with your deployed App ID if different
const ALGOD_SERVER = "https://testnet-api.algonode.cloud";
const ALGOD_PORT = "";
const ALGOD_TOKEN = "";

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
const peraWallet = new window.PeraWalletConnect.PeraWalletConnect();
const textEncoder = new TextEncoder();

let connectedAddress = "";

function setStatus(message) {
  document.getElementById("status").innerText = "Status: " + message;
}

function setTxId(txId) {
  document.getElementById("txId").innerText = txId ? "Transaction ID: " + txId : "";
}

function setAddress(address) {
  document.getElementById("address").innerText = address || "Not connected";
}

function toggleActionButtons(disabled) {
  document.getElementById("depositBtn").disabled = disabled;
  document.getElementById("confirmBtn").disabled = disabled;
  document.getElementById("refundBtn").disabled = disabled;
}

async function connectWallet() {
  try {
    setStatus("Connecting wallet...");
    const accounts = await peraWallet.connect();
    connectedAddress = accounts[0] || "";

    if (!connectedAddress) {
      throw new Error("No account returned from Pera Wallet");
    }

    setAddress(connectedAddress);
    setStatus("Wallet connected");
  } catch (error) {
    console.error(error);
    setStatus("Wallet connection failed");
  }
}

function flattenSignedTxns(signedResult) {
  if (signedResult instanceof Uint8Array) return [signedResult];
  if (Array.isArray(signedResult)) {
    const flat = [];
    for (let i = 0; i < signedResult.length; i += 1) {
      const item = signedResult[i];
      if (item instanceof Uint8Array) {
        flat.push(item);
      } else if (Array.isArray(item)) {
        for (let j = 0; j < item.length; j += 1) {
          if (item[j] instanceof Uint8Array) flat.push(item[j]);
        }
      }
    }
    return flat;
  }
  throw new Error("Unsupported signed transaction format from Pera Wallet");
}

async function signWithPera(txn) {
  const txnsToSign = [
    [
      {
        txn: txn,
        signers: [connectedAddress],
      },
    ],
  ];

  const signedResult = await peraWallet.signTransaction(txnsToSign);
  const signedTxns = flattenSignedTxns(signedResult);
  if (!signedTxns.length) throw new Error("No signed transaction returned");
  return signedTxns[0];
}

async function callNoOp(methodName) {
  if (!connectedAddress) {
    setStatus("Connect wallet first");
    return;
  }

  try {
    setTxId("");
    setStatus("Building " + methodName + " transaction...");

    const suggestedParams = await algodClient.getTransactionParams().do();
    const appArgs = [textEncoder.encode(methodName)];

    const txn = algosdk.makeApplicationNoOpTxnFromObject({
      from: connectedAddress,
      appIndex: APP_ID,
      appArgs: appArgs,
      suggestedParams: suggestedParams,
    });

    setStatus("Please approve in Pera Wallet...");
    const signedTxn = await signWithPera(txn);

    const submitResult = await algodClient.sendRawTransaction(signedTxn).do();
    const txId = submitResult.txid;

    await algosdk.waitForConfirmation(algodClient, txId, 4);

    setTxId(txId);
    setStatus(methodName + " successful");
  } catch (error) {
    console.error(error);
    setStatus(methodName + " failed");
  }
}

document.getElementById("appIdValue").innerText = String(APP_ID);
document.getElementById("connectBtn").addEventListener("click", connectWallet);
document.getElementById("depositBtn").addEventListener("click", function () {
  callNoOp("deposit");
});
document.getElementById("confirmBtn").addEventListener("click", function () {
  callNoOp("confirm");
});
document.getElementById("refundBtn").addEventListener("click", function () {
  callNoOp("refund");
});

toggleActionButtons(false);