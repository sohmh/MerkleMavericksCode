
# 🛡️ LockChain — Decentralized Escrow dApp

# By Merkle Mavericks

Team : 

Soham Gurav , Atharva Gore

A clean, interactive **blockchain-based escrow application** that enables secure transactions between a Buyer, Seller, and Arbiter using Ethereum smart contracts.

Built with a focus on **clarity, UX, and real-world transaction flow visualization**.

---

## 🚀 Overview

LockChain is a **Web3 escrow system** where:

* A **Buyer** deposits ETH into a smart contract
* A **Seller** delivers goods/services
* An **Arbiter** can resolve disputes if needed

The app provides a **guided UI + lifecycle tracker**, making blockchain interactions intuitive even for first-time users.

---

## ✨ Key Features

### 🔐 Role-Based Access System

* Users select a role:

  * 🛒 Buyer
  * 📦 Seller
  * ⚖️ Arbiter
* UI dynamically adapts based on role permissions
* Wallet + role are persisted using localStorage

---

### 🦊 MetaMask Integration

* Connect wallet securely
* Automatic session restore on reload
* Network validation (Sepolia testnet)

---

### 💰 Escrow Smart Contract Interaction

* Buyer can:

  * Deposit ETH into escrow (currently **0.01 ETH**)
  * Confirm delivery

* Arbiter can:

  * Issue refunds

* Seller receives funds only after confirmation

---

### 📊 Escrow Lifecycle Tracker

Visual representation of contract state:

1. Awaiting Payment
2. Awaiting Delivery
3. Complete
4. Refunded

➡️ Makes smart contract states easy to understand at a glance

---

### 📈 Live Transaction Log

* Displays real-time transaction activity
* Shows timestamps + transaction updates
* Improves transparency and debugging

---

### 🎨 Clean UI/UX

* Modern dark-themed interface
* Smooth onboarding flow (role → wallet → app)
* Structured dashboard layout (stats, actions, logs)

---

## 🏗️ Tech Stack

* **Frontend:** HTML, CSS, Vanilla JavaScript 
* **Blockchain:** Ethereum (Sepolia Testnet)
* **Smart Contract:** Solidity (`Escrow.sol`)
* **Web3 Library:** ethers.js
* **Wallet:** MetaMask
* **Additional SDK:** algosdk (included but optional) 

---

## ⚙️ How It Works

1. User selects role (Buyer / Seller / Arbiter)
2. Connects MetaMask wallet
3. App initializes contract interaction
4. Based on role:

   * Buyer deposits ETH
   * Buyer confirms delivery
   * Arbiter issues refund
5. UI updates lifecycle + logs automatically

---

## 📂 Project Structure

```
/project-root
│── index.html        # Main UI + layout
│── script.js         # Web3 logic + contract interaction
│── Escrow.sol        # Smart contract
│── package.json      # Dependencies
│── README.md
```

---

## 🧪 Setup Instructions

### 1. Clone Repository

```bash
git clone https://github.com/sohmh/MerkleMavericksCode.git
cd MerkleMavericksCode
```

### 2. Open the App

* Simply open `index.html` in your browser

### 3. Connect MetaMask

* Switch to **Sepolia Testnet**
* Ensure you have test ETH

### 4. Deploy Smart Contract

* Use Remix IDE
* Deploy `Escrow.sol`
* Copy contract address into `script.js`

### 5. Start Using

* Select role → connect wallet → interact with escrow

---

## 🎯 What Makes This Project Stand Out

✅ Clean separation of roles (Buyer / Seller / Arbiter)
✅ Visual lifecycle tracking (not just buttons)
✅ Persistent session handling
✅ Real smart contract interaction (not simulated)
✅ Strong UI/UX for a Web3 project

---

## ⚠️ Current Limitations

* Deposit amount is fixed at **0.01 ETH**
* No multi-order system (single escrow instance)
* Order details are not customizable yet

---

## 🔮 Future Improvements

* Custom order creation (item, price, deadline)
* Multiple concurrent escrows
* On-chain order metadata
* Improved dispute resolution logic
* Mobile responsiveness

---

## 👨‍💻 Team

**Team Name:** Merkle Mavericks 

---

## 📜 License

ISC License
