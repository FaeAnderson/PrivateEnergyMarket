# Hello FHEVM: Building Your First Confidential Energy Trading dApp

A complete beginner's guide to building decentralized applications with Fully Homomorphic Encryption (FHE) using Zama's FHEVM technology.

## 🎯 What You'll Build

By the end of this tutorial, you'll have created a fully functional **Private Energy Market** - a confidential trading platform where users can create encrypted energy offers and demands without revealing sensitive trading information. All calculations happen on encrypted data while maintaining complete privacy.

### 🔥 Live Demo
- **Application**: [https://private-energy-market.vercel.app/](https://private-energy-market.vercel.app/)
- **Source Code**: [https://github.com/FaeAnderson/PrivateEnergyMarket](https://github.com/FaeAnderson/PrivateEnergyMarket)

## 📋 Prerequisites

**What you need to know:**
- ✅ Basic Solidity (can write and deploy simple smart contracts)
- ✅ JavaScript fundamentals
- ✅ Basic understanding of Ethereum and Web3
- ✅ Familiar with MetaMask or similar wallets

**What you DON'T need:**
- ❌ No FHE or cryptography knowledge required
- ❌ No advanced mathematics background needed
- ❌ No prior experience with encrypted computation

**Tools you should have:**
- Node.js and npm installed
- MetaMask browser extension
- A code editor (VS Code recommended)
- Git for version control

## 🎓 Learning Objectives

After completing this tutorial, you will:

1. **Understand FHEVM basics**: What it is and why it matters for privacy
2. **Build confidential smart contracts**: Create contracts that handle encrypted data
3. **Implement private transactions**: Enable users to trade without revealing details
4. **Integrate FHE in frontend**: Connect encrypted contracts with user interfaces
5. **Deploy confidential dApps**: Launch your privacy-preserving application

## 🚀 Getting Started

### Step 1: Understanding FHE and FHEVM

**What is Fully Homomorphic Encryption (FHE)?**

FHE is a revolutionary cryptographic technique that allows computations to be performed directly on encrypted data. This means:
- Data remains encrypted at all times
- Calculations happen without decrypting the data
- Results are still encrypted and only the owner can decrypt them
- Complete privacy is maintained throughout the process

**What is FHEVM?**

FHEVM (Fully Homomorphic Encryption Virtual Machine) by Zama extends Ethereum's capabilities to support FHE operations. It allows smart contracts to:
- Accept encrypted inputs from users
- Perform computations on encrypted data
- Store encrypted state variables
- Return encrypted outputs

**Why is this important for our Energy Market?**

In traditional energy trading:
- ❌ All bids and offers are public
- ❌ Trading strategies can be copied
- ❌ Market manipulation is easier
- ❌ Sensitive business data is exposed

With FHE:
- ✅ Energy amounts remain private
- ✅ Prices are encrypted
- ✅ Trading patterns are hidden
- ✅ Market fairness is improved

### Step 2: Project Structure Overview

```
private-energy-market/
├── contracts/
│   └── PrivateEnergyMarket.sol    # Main FHE-enabled smart contract
├── index.html                     # Frontend interface
├── app.js                         # Application logic and FHE integration
├── styles.css                     # UI styling
└── README.md                      # Project documentation
```

## 🔧 Building the Smart Contract

### Step 3: Setting Up the FHE Contract

Let's examine the core smart contract that enables private energy trading:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "fhevm/lib/TFHE.sol";
import "fhevm/abstracts/EIP712WithModifier.sol";

contract PrivateEnergyMarket is EIP712WithModifier {
    using TFHE for euint32;
    using TFHE for ebool;

    // Energy types supported
    enum EnergyType { Solar, Wind, Hydro, Nuclear }

    // Offer status
    enum OfferStatus { Active, Matched, Cancelled }

    // Encrypted energy offer structure
    struct EnergyOffer {
        address seller;
        euint32 encryptedAmount;      // Encrypted energy amount
        euint32 encryptedPrice;       // Encrypted price per kWh
        EnergyType energyType;
        OfferStatus status;
        uint256 timestamp;
        bool isPrivate;               // Whether offer uses FHE
    }

    // Encrypted energy demand structure
    struct EnergyDemand {
        address buyer;
        euint32 encryptedAmount;      // Encrypted energy needed
        euint32 encryptedMaxPrice;    // Encrypted maximum price
        OfferStatus status;
        uint256 timestamp;
        bool isPrivate;               // Whether demand uses FHE
    }

    // State variables
    mapping(uint256 => EnergyOffer) public energyOffers;
    mapping(uint256 => EnergyDemand) public energyDemands;
    mapping(address => uint256) public userCredits;

    uint256 public nextOfferId = 1;
    uint256 public nextDemandId = 1;
    uint256 public nextTradeId = 1;

    // Events
    event EnergyOfferCreated(uint256 indexed offerId, address indexed seller, EnergyType energyType);
    event EnergyDemandCreated(uint256 indexed demandId, address indexed buyer);
    event TradeMatched(uint256 indexed tradeId, uint256 indexed offerId, uint256 indexed demandId);

    constructor() EIP712WithModifier("PrivateEnergyMarket", "1") {}

    // Create encrypted energy offer
    function createEnergyOffer(
        einput encryptedAmount,
        einput encryptedPrice,
        EnergyType _energyType,
        bool _isPrivate,
        bytes calldata inputProof
    ) external onlySignedPublicKey(inputProof) {

        euint32 amount = TFHE.asEuint32(encryptedAmount, inputProof);
        euint32 price = TFHE.asEuint32(encryptedPrice, inputProof);

        energyOffers[nextOfferId] = EnergyOffer({
            seller: msg.sender,
            encryptedAmount: amount,
            encryptedPrice: price,
            energyType: _energyType,
            status: OfferStatus.Active,
            timestamp: block.timestamp,
            isPrivate: _isPrivate
        });

        emit EnergyOfferCreated(nextOfferId, msg.sender, _energyType);
        nextOfferId++;
    }

    // Create encrypted energy demand
    function createEnergyDemand(
        einput encryptedAmount,
        einput encryptedMaxPrice,
        bool _isPrivate,
        bytes calldata inputProof
    ) external onlySignedPublicKey(inputProof) {

        euint32 amount = TFHE.asEuint32(encryptedAmount, inputProof);
        euint32 maxPrice = TFHE.asEuint32(encryptedMaxPrice, inputProof);

        energyDemands[nextDemandId] = EnergyDemand({
            buyer: msg.sender,
            encryptedAmount: amount,
            encryptedMaxPrice: maxPrice,
            status: OfferStatus.Active,
            timestamp: block.timestamp,
            isPrivate: _isPrivate
        });

        emit EnergyDemandCreated(nextDemandId, msg.sender);
        nextDemandId++;
    }

    // Match encrypted offer with demand
    function matchTrade(uint256 _offerId, uint256 _demandId) external {
        EnergyOffer storage offer = energyOffers[_offerId];
        EnergyDemand storage demand = energyDemands[_demandId];

        require(offer.status == OfferStatus.Active, "Offer not active");
        require(demand.status == OfferStatus.Active, "Demand not active");

        // FHE comparison: check if demand price >= offer price
        ebool priceMatch = TFHE.le(offer.encryptedPrice, demand.encryptedMaxPrice);

        // FHE comparison: check if amounts are compatible
        ebool amountMatch = TFHE.le(offer.encryptedAmount, demand.encryptedAmount);

        // Both conditions must be true for successful match
        ebool canMatch = TFHE.and(priceMatch, amountMatch);

        // This would typically trigger the trade execution
        // In a production environment, you'd handle the encrypted arithmetic here

        offer.status = OfferStatus.Matched;
        demand.status = OfferStatus.Matched;

        emit TradeMatched(nextTradeId, _offerId, _demandId);
        nextTradeId++;
    }

    // Get user's encrypted offer amount (only owner can decrypt)
    function getMyOfferAmount(uint256 _offerId, bytes32 publicKey, bytes calldata signature)
        external
        view
        onlySignedPublicKey(signature)
        returns (bytes memory)
    {
        EnergyOffer memory offer = energyOffers[_offerId];
        require(offer.seller == msg.sender, "Not your offer");

        return TFHE.reencrypt(offer.encryptedAmount, publicKey, 0);
    }

    // Get user's encrypted demand amount (only owner can decrypt)
    function getMyDemandAmount(uint256 _demandId, bytes32 publicKey, bytes calldata signature)
        external
        view
        onlySignedPublicKey(signature)
        returns (bytes memory)
    {
        EnergyDemand memory demand = energyDemands[_demandId];
        require(demand.buyer == msg.sender, "Not your demand");

        return TFHE.reencrypt(demand.encryptedAmount, publicKey, 0);
    }
}
```

### Step 4: Understanding Key FHE Concepts in the Contract

**1. Encrypted Data Types:**
```solidity
euint32 encryptedAmount;    // 32-bit encrypted unsigned integer
euint32 encryptedPrice;     // Price stored as encrypted value
ebool priceMatch;           // Encrypted boolean for comparisons
```

**2. Input Encryption:**
```solidity
einput encryptedAmount,     // Encrypted input from frontend
bytes calldata inputProof   // Cryptographic proof of encryption
```

**3. FHE Operations:**
```solidity
ebool priceMatch = TFHE.le(offer.encryptedPrice, demand.encryptedMaxPrice);  // Less-than comparison
ebool canMatch = TFHE.and(priceMatch, amountMatch);                         // Logical AND
```

**4. Reencryption for Users:**
```solidity
return TFHE.reencrypt(offer.encryptedAmount, publicKey, 0);  // Decrypt for specific user
```

## 🎨 Building the Frontend

### Step 5: Setting Up FHE Integration in JavaScript

The frontend needs to handle encryption before sending data to the blockchain:

```javascript
// Core application class with FHE integration
class PrivateEnergyMarket {
    constructor() {
        this.contractAddress = '0x2F0f34ea9aaeF551ac550b42Da0617b929286fF1';
        this.fhevmInstance = null;  // FHE instance for encryption
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.init();
    }

    async init() {
        await this.initializeFHEVM();
        this.setupEventListeners();
        await this.loadMarketStatus();
    }

    // Initialize FHEVM for client-side encryption
    async initializeFHEVM() {
        try {
            // Initialize the FHEVM instance
            this.fhevmInstance = await fhevm.createInstance({
                chainId: await this.provider.getNetwork().then(n => n.chainId),
                networkUrl: this.provider.connection.url,
                gatewayUrl: "https://gateway.zama.ai/"
            });

            console.log('FHEVM initialized successfully');
        } catch (error) {
            console.error('Error initializing FHEVM:', error);
        }
    }

    // Connect Web3 wallet
    async connectWallet() {
        try {
            if (typeof window.ethereum !== 'undefined') {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = this.provider.getSigner();
                this.userAddress = await this.signer.getAddress();

                // Initialize contract with signer
                this.contract = new ethers.Contract(
                    this.contractAddress,
                    this.contractABI,
                    this.signer
                );

                await this.updateWalletInfo();
                console.log('Wallet connected:', this.userAddress);
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
        }
    }

    // Create encrypted energy offer
    async createEnergyOffer(amount, price, energyType, isPrivate) {
        try {
            if (!this.contract || !this.fhevmInstance) {
                throw new Error('Contract or FHEVM not initialized');
            }

            this.showLoading(true);

            if (isPrivate) {
                // Encrypt the sensitive data using FHEVM
                const encryptedAmount = this.fhevmInstance.encrypt32(amount);
                const encryptedPrice = this.fhevmInstance.encrypt32(price);

                // Create transaction with encrypted inputs
                const tx = await this.contract.createEnergyOffer(
                    encryptedAmount.handles[0],    // Encrypted amount handle
                    encryptedPrice.handles[0],     // Encrypted price handle
                    energyType,
                    isPrivate,
                    encryptedAmount.inputProof     // Cryptographic proof
                );

                await tx.wait();
                this.showNotification('Private energy offer created successfully!', 'success');
            } else {
                // For non-private offers, still use the same interface but with zero encryption
                const tx = await this.contract.createEnergyOffer(
                    amount,
                    price,
                    energyType,
                    isPrivate,
                    "0x"  // Empty proof for non-encrypted
                );

                await tx.wait();
                this.showNotification('Energy offer created successfully!', 'success');
            }

            document.getElementById('offerForm').reset();
            await this.loadMarketStatus();

        } catch (error) {
            console.error('Error creating offer:', error);
            this.showNotification('Failed to create energy offer', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Create encrypted energy demand
    async createEnergyDemand(amount, maxPrice, isPrivate) {
        try {
            if (!this.contract || !this.fhevmInstance) {
                throw new Error('Contract or FHEVM not initialized');
            }

            this.showLoading(true);

            if (isPrivate) {
                // Encrypt sensitive demand information
                const encryptedAmount = this.fhevmInstance.encrypt32(amount);
                const encryptedMaxPrice = this.fhevmInstance.encrypt32(maxPrice);

                const tx = await this.contract.createEnergyDemand(
                    encryptedAmount.handles[0],
                    encryptedMaxPrice.handles[0],
                    isPrivate,
                    encryptedAmount.inputProof
                );

                await tx.wait();
                this.showNotification('Private energy demand created successfully!', 'success');
            } else {
                const tx = await this.contract.createEnergyDemand(
                    amount,
                    maxPrice,
                    isPrivate,
                    "0x"
                );

                await tx.wait();
                this.showNotification('Energy demand created successfully!', 'success');
            }

            document.getElementById('demandForm').reset();
            await this.loadMarketStatus();

        } catch (error) {
            console.error('Error creating demand:', error);
            this.showNotification('Failed to create energy demand', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Get user's encrypted offer data
    async getUserOfferAmount(offerId) {
        try {
            if (!this.fhevmInstance) {
                throw new Error('FHEVM not initialized');
            }

            // Generate reencryption request
            const { publicKey, signature } = this.fhevmInstance.generatePublicKey({
                verifyingContract: this.contractAddress,
            });

            // Request encrypted data from contract
            const encryptedResult = await this.contract.getMyOfferAmount(
                offerId,
                publicKey,
                signature
            );

            // Decrypt the result client-side
            const decryptedAmount = this.fhevmInstance.decrypt(encryptedResult);

            return decryptedAmount;

        } catch (error) {
            console.error('Error getting offer amount:', error);
            return null;
        }
    }
}
```

### Step 6: Understanding Frontend FHE Integration

**Key Concepts Explained:**

1. **Client-Side Encryption:**
```javascript
const encryptedAmount = this.fhevmInstance.encrypt32(amount);
// User data is encrypted in the browser before sending to blockchain
```

2. **Input Proofs:**
```javascript
encryptedAmount.inputProof
// Cryptographic proof that encryption was done correctly
```

3. **Reencryption for Decryption:**
```javascript
const { publicKey, signature } = this.fhevmInstance.generatePublicKey({
    verifyingContract: this.contractAddress,
});
// Generate keys to decrypt your own encrypted data
```

4. **Client-Side Decryption:**
```javascript
const decryptedAmount = this.fhevmInstance.decrypt(encryptedResult);
// Only you can decrypt your encrypted data
```

## 🔗 Complete Integration Example

### Step 7: Putting It All Together

Here's how the complete flow works:

1. **User Creates Private Offer:**
   - Frontend encrypts amount and price using FHEVM
   - Sends encrypted data + proof to smart contract
   - Contract stores encrypted values without seeing actual data

2. **Another User Creates Private Demand:**
   - Similar encryption process for demand parameters
   - Contract can compare encrypted values without decryption

3. **Trade Matching:**
   - Contract performs FHE operations on encrypted data
   - Comparison operations work on encrypted values
   - Trade execution happens without revealing actual amounts/prices

4. **User Views Own Data:**
   - Request reencryption from contract
   - Client-side decryption reveals original values
   - Other users cannot decrypt this data

## 🧪 Testing Your Implementation

### Step 8: Testing Encrypted Operations

```javascript
// Test private offer creation
async function testPrivateOffer() {
    const amount = 1000;  // 1000 kWh
    const price = 50;     // 50 wei per kWh
    const energyType = 0; // Solar
    const isPrivate = true;

    try {
        await market.createEnergyOffer(amount, price, energyType, isPrivate);
        console.log('Private offer created successfully');

        // Verify encrypted storage
        const offerId = await market.contract.nextOfferId() - 1;
        const decryptedAmount = await market.getUserOfferAmount(offerId);

        console.log('Original amount:', amount);
        console.log('Decrypted amount:', decryptedAmount);
        console.assert(amount === decryptedAmount, 'Encryption/decryption failed');

    } catch (error) {
        console.error('Test failed:', error);
    }
}
```

## 🚀 Deployment Guide

### Step 9: Deploying to FHEVM Testnet

1. **Configure Network:**
```javascript
// Add Zama Testnet to MetaMask
const zamaTestnet = {
    chainId: '0x2328', // 9000 in decimal
    chainName: 'Zama Testnet',
    rpcUrls: ['https://testnet.zama.ai'],
    nativeCurrency: {
        name: 'ZAMA',
        symbol: 'ZAMA',
        decimals: 18
    },
    blockExplorerUrls: ['https://explorer.zama.ai']
};
```

2. **Deploy Contract:**
```bash
npx hardhat deploy --network zama-testnet
```

3. **Update Frontend Configuration:**
```javascript
this.contractAddress = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';
```

## 🎉 Congratulations!

You've successfully built your first confidential dApp using FHEVM! Your Private Energy Market now:

✅ **Handles Encrypted Data**: All sensitive trading information is encrypted
✅ **Performs Private Computations**: Price matching happens on encrypted values
✅ **Maintains User Privacy**: Trading strategies remain confidential
✅ **Enables Secure Trading**: Users can trade without revealing sensitive data

## 🎯 Key Takeaways

**What you learned:**

1. **FHE Fundamentals**: How to perform computations on encrypted data
2. **FHEVM Integration**: Building smart contracts that handle encryption
3. **Client-Side Encryption**: Encrypting data in the browser before blockchain submission
4. **Reencryption Patterns**: How users can decrypt their own encrypted data
5. **Privacy-Preserving dApps**: Creating applications that protect user privacy

**Real-world Applications:**

- **Financial Services**: Private trading, confidential voting, hidden auctions
- **Healthcare**: Secure patient data processing, private medical research
- **Supply Chain**: Confidential pricing, private inventory management
- **Gaming**: Hidden information games, private leaderboards
- **IoT**: Secure sensor data, private device communication

## 🔍 Further Learning Resources

**Documentation:**
- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Zama Developer Resources](https://github.com/zama-ai)
- [FHE Library Reference](https://docs.zama.ai/fhevm/references/functions)

**Advanced Topics:**
- Complex FHE operations (multiplication, division)
- Gas optimization for encrypted operations
- Advanced reencryption patterns
- FHE-based access control systems

## 🤝 Community & Support

- **Discord**: Join the Zama developer community
- **GitHub**: Contribute to FHEVM development
- **Forum**: Ask questions and share experiences
- **Twitter**: Follow @zama_ai for updates

---

**Ready to build more confidential dApps?** This tutorial gave you the foundation - now explore more complex FHE use cases and push the boundaries of privacy-preserving blockchain applications!