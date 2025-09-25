// Private Energy Market Application
class PrivateEnergyMarket {
    constructor() {
        this.contractAddress = '0x2F0f34ea9aaeF551ac550b42Da0617b929286fF1';
        this.contractABI = [
            // View functions
            "function owner() view returns (address)",
            "function marketSessionId() view returns (uint256)",
            "function sessionStartTime() view returns (uint256)",
            "function sessionDuration() view returns (uint256)",
            "function isMarketActive() view returns (bool)",
            "function userCredits(address) view returns (uint256)",
            "function nextOfferId() view returns (uint256)",
            "function nextDemandId() view returns (uint256)",
            "function nextTradeId() view returns (uint256)",

            // Mappings
            "function energyOffers(uint256) view returns (address seller, uint8 energyType, uint8 status, uint256 timestamp, bool isPrivate)",
            "function energyDemands(uint256) view returns (address buyer, uint8 status, uint256 timestamp, bool isPrivate)",
            "function trades(uint256) view returns (uint256 offerId, uint256 demandId, address seller, address buyer, uint32 energyAmount, uint32 tradePrice, uint8 energyType, uint256 timestamp, bool completed)",

            // User functions
            "function getUserOffers(address _user) view returns (uint256[])",
            "function getUserDemands(address _user) view returns (uint256[])",
            "function getMarketSessionInfo() view returns (uint256 sessionId, uint256 startTime, bool isActive, uint256 totalOffers, uint256 totalDemands)",

            // State changing functions
            "function createEnergyOffer(uint32 _energyAmount, uint32 _pricePerKWh, uint8 _energyType, bool _isPrivate)",
            "function createEnergyDemand(uint32 _energyNeeded, uint32 _maxPricePerKWh, bool _isPrivate)",
            "function matchTrade(uint256 _offerId, uint256 _demandId)",
            "function cancelOffer(uint256 _offerId)",
            "function cancelDemand(uint256 _demandId)",
            "function addCredits(uint256 _amount) payable",
            "function startNewMarketSession()",
            "function setSessionDuration(uint256 _duration)",

            // Events
            "event MarketSessionStarted(uint256 indexed sessionId, uint256 startTime)",
            "event EnergyOfferCreated(uint256 indexed offerId, address indexed seller, uint8 energyType)",
            "event EnergyDemandCreated(uint256 indexed demandId, address indexed buyer)",
            "event TradeMatched(uint256 indexed tradeId, uint256 indexed offerId, uint256 indexed demandId)",
            "event TradeCompleted(uint256 indexed tradeId, address indexed seller, address indexed buyer, uint32 amount, uint32 price)",
            "event OfferCancelled(uint256 indexed offerId, address indexed seller)",
            "event DemandCancelled(uint256 indexed demandId, address indexed buyer)"
        ];

        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.userAddress = null;
        this.demoMode = false;

        this.init();
    }

    async init() {
        this.setupEventListeners();
        console.log('App initialized, demo mode:', this.demoMode);
        await this.checkWalletConnection();
    }

    setupEventListeners() {
        // Wallet connection
        document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());

        // Market status
        document.getElementById('refreshMarket').addEventListener('click', () => this.loadMarketStatus());
        document.getElementById('startMarketSession').addEventListener('click', () => this.startNewMarketSession());
        document.getElementById('toggleDemo').addEventListener('click', () => this.toggleDemoMode());

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Forms
        document.getElementById('offerForm').addEventListener('submit', (e) => this.handleOfferSubmit(e));
        document.getElementById('demandForm').addEventListener('submit', (e) => this.handleDemandSubmit(e));

        // Trade matching
        document.getElementById('matchTradeBtn').addEventListener('click', () => this.handleTradeMatch());
        document.getElementById('loadUserOffers').addEventListener('click', () => this.loadUserOffers());
        document.getElementById('loadUserDemands').addEventListener('click', () => this.loadUserDemands());

        // Trade history
        document.getElementById('loadTradeBtn').addEventListener('click', () => this.loadTradeDetails());

        // Credits
        document.getElementById('addCreditsBtn').addEventListener('click', () => this.addCredits());
    }

    async checkWalletConnection() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    await this.connectWallet();
                }
            } catch (error) {
                console.error('Error checking wallet connection:', error);
            }
        }
    }

    async connectWallet() {
        try {
            if (typeof window.ethereum === 'undefined') {
                this.showNotification('Please install MetaMask!', 'error');
                return;
            }

            this.showLoading(true);

            await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.userAddress = await this.signer.getAddress();

            this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer);

            // Update UI
            document.getElementById('connectWallet').style.display = 'none';
            document.getElementById('walletInfo').classList.remove('hidden');
            document.getElementById('walletAddress').textContent = `${this.userAddress.slice(0, 6)}...${this.userAddress.slice(-4)}`;

            await this.updateBalance();
            await this.loadMarketStatus();
            await this.loadUserCredits();
            await this.checkOwnership();
            await this.displayOwnerInfo();

            // Show user action buttons
            document.getElementById('loadUserOffers').classList.remove('hidden');
            document.getElementById('loadUserDemands').classList.remove('hidden');

            this.showNotification('Wallet connected successfully!', 'success');
            this.showLoading(false);

        } catch (error) {
            console.error('Wallet connection error:', error);
            this.showNotification('Failed to connect wallet', 'error');
            this.showLoading(false);
        }
    }

    async updateBalance() {
        try {
            const balance = await this.provider.getBalance(this.userAddress);
            document.getElementById('balance').textContent = `${ethers.utils.formatEther(balance)} ETH`;
        } catch (error) {
            console.error('Error updating balance:', error);
        }
    }

    async loadMarketStatus() {
        try {
            if (!this.contract) return;

            const marketInfo = await this.contract.getMarketSessionInfo();

            document.getElementById('sessionId').textContent = marketInfo.sessionId.toString();
            document.getElementById('marketActive').textContent = marketInfo.isActive ? 'Active' : 'Closed';
            document.getElementById('totalOffers').textContent = marketInfo.totalOffers.toString();
            document.getElementById('totalDemands').textContent = marketInfo.totalDemands.toString();

        } catch (error) {
            console.error('Error loading market status:', error);
            this.showNotification('Failed to load market status', 'error');
        }
    }

    async loadUserCredits() {
        try {
            if (!this.contract || !this.userAddress) return;

            const credits = await this.contract.userCredits(this.userAddress);
            document.getElementById('userCredits').textContent = credits.toString();

        } catch (error) {
            console.error('Error loading user credits:', error);
        }
    }

    toggleDemoMode() {
        this.demoMode = !this.demoMode;
        const toggleBtn = document.getElementById('toggleDemo');

        console.log('Demo mode toggled:', this.demoMode);

        if (this.demoMode) {
            toggleBtn.textContent = 'Disable Demo Mode';
            toggleBtn.classList.remove('btn-secondary');
            toggleBtn.classList.add('btn-primary');
            this.showNotification('Demo mode enabled - simulating market functions', 'info');

            // Show demo indicator
            document.getElementById('demoIndicator').classList.remove('hidden');

            // Update market status for demo
            document.getElementById('sessionId').textContent = '999';
            document.getElementById('marketActive').textContent = 'Active (Demo)';
            document.getElementById('totalOffers').textContent = '5';
            document.getElementById('totalDemands').textContent = '3';
        } else {
            toggleBtn.textContent = 'Enable Demo Mode';
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-secondary');
            this.showNotification('Demo mode disabled - using real blockchain', 'info');

            // Hide demo indicator
            document.getElementById('demoIndicator').classList.add('hidden');

            this.loadMarketStatus();
        }
    }

    async displayOwnerInfo() {
        try {
            if (!this.contract) return;

            const owner = await this.contract.owner();
            console.log('Contract owner:', owner);

            // Add owner info to the page
            const ownerInfo = document.createElement('div');
            ownerInfo.style.cssText = 'background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; font-size: 0.9rem;';
            ownerInfo.innerHTML = `<strong>Contract Owner:</strong> ${owner}`;
            document.querySelector('.market-status').appendChild(ownerInfo);

        } catch (error) {
            console.error('Error getting owner info:', error);
        }
    }

    async checkOwnership() {
        try {
            if (!this.contract || !this.userAddress) return;

            const owner = await this.contract.owner();
            const isOwner = owner.toLowerCase() === this.userAddress.toLowerCase();

            const startButton = document.getElementById('startMarketSession');
            if (isOwner) {
                startButton.style.display = 'inline-block';
                startButton.textContent = 'Start New Market Session (Owner)';
            } else {
                startButton.style.display = 'none';
            }

        } catch (error) {
            console.error('Error checking ownership:', error);
        }
    }

    async startNewMarketSession() {
        try {
            if (!this.contract) {
                this.showNotification('Please connect your wallet first', 'error');
                return;
            }

            this.showLoading(true);

            const tx = await this.contract.startNewMarketSession();
            await tx.wait();

            this.showNotification('New market session started successfully!', 'success');
            await this.loadMarketStatus();

        } catch (error) {
            console.error('Error starting market session:', error);
            this.showNotification('Failed to start market session', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');
    }

    async handleOfferSubmit(e) {
        e.preventDefault();

        try {
            console.log('Creating offer, demo mode:', this.demoMode);

            const amount = parseInt(document.getElementById('offerAmount').value);
            const price = parseInt(document.getElementById('offerPrice').value);
            const energyType = parseInt(document.getElementById('energyType').value);
            const isPrivate = document.getElementById('offerPrivate').checked;

            if (this.demoMode) {
                // Simulate demo transaction
                console.log('Demo mode: simulating offer creation');
                this.showLoading(true);
                setTimeout(() => {
                    this.showNotification('Energy offer created successfully! (Demo)', 'success');
                    document.getElementById('offerForm').reset();
                    this.showLoading(false);
                }, 1000);
                return;
            }

            if (!this.contract) {
                this.showNotification('Please connect your wallet first or enable demo mode', 'error');
                return;
            }

            this.showLoading(true);

            const tx = await this.contract.createEnergyOffer(amount, price, energyType, isPrivate);
            await tx.wait();

            this.showNotification('Energy offer created successfully!', 'success');
            document.getElementById('offerForm').reset();
            await this.loadMarketStatus();

        } catch (error) {
            console.error('Error creating offer:', error);
            this.showNotification('Failed to create energy offer', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleDemandSubmit(e) {
        e.preventDefault();

        try {
            if (!this.contract && !this.demoMode) {
                this.showNotification('Please connect your wallet first or enable demo mode', 'error');
                return;
            }

            this.showLoading(true);

            const amount = parseInt(document.getElementById('demandAmount').value);
            const maxPrice = parseInt(document.getElementById('demandMaxPrice').value);
            const isPrivate = document.getElementById('demandPrivate').checked;

            if (this.demoMode) {
                // Simulate demo transaction
                console.log('Demo mode: simulating demand creation');
                setTimeout(() => {
                    this.showNotification('Energy demand created successfully! (Demo)', 'success');
                    document.getElementById('demandForm').reset();
                    this.showLoading(false);
                }, 1000);
                return;
            }

            const tx = await this.contract.createEnergyDemand(amount, maxPrice, isPrivate);
            await tx.wait();

            this.showNotification('Energy demand created successfully!', 'success');
            document.getElementById('demandForm').reset();
            await this.loadMarketStatus();

        } catch (error) {
            console.error('Error creating demand:', error);
            this.showNotification('Failed to create energy demand', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleTradeMatch() {
        try {
            if (!this.contract) {
                this.showNotification('Please connect your wallet first', 'error');
                return;
            }

            const offerId = parseInt(document.getElementById('matchOfferId').value);
            const demandId = parseInt(document.getElementById('matchDemandId').value);

            if (!offerId || !demandId) {
                this.showNotification('Please enter both Offer ID and Demand ID', 'error');
                return;
            }

            this.showLoading(true);

            const tx = await this.contract.matchTrade(offerId, demandId);
            await tx.wait();

            this.showNotification('Trade matched successfully!', 'success');
            document.getElementById('matchOfferId').value = '';
            document.getElementById('matchDemandId').value = '';

        } catch (error) {
            console.error('Error matching trade:', error);
            this.showNotification('Failed to match trade', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadUserOffers() {
        try {
            if (!this.contract || !this.userAddress) return;

            const offerIds = await this.contract.getUserOffers(this.userAddress);
            const offersList = document.getElementById('userOffersList');

            if (offerIds.length === 0) {
                offersList.innerHTML = '<p>No offers found</p>';
                return;
            }

            let offersHTML = '';
            for (let i = 0; i < offerIds.length; i++) {
                const offerId = offerIds[i];
                const offer = await this.contract.energyOffers(offerId);

                const energyTypes = ['Solar', 'Wind', 'Hydro', 'Nuclear'];
                const statusTypes = ['Active', 'Matched', 'Cancelled'];

                offersHTML += `
                    <div class="offer-item">
                        <h4>Offer #${offerId.toString()}</h4>
                        <p><strong>Type:</strong> ${energyTypes[offer.energyType]}</p>
                        <p><strong>Status:</strong> ${statusTypes[offer.status]}</p>
                        <p><strong>Private:</strong> ${offer.isPrivate ? 'Yes' : 'No'}</p>
                        <p><strong>Created:</strong> ${new Date(offer.timestamp * 1000).toLocaleString()}</p>
                    </div>
                `;
            }

            offersList.innerHTML = offersHTML;

        } catch (error) {
            console.error('Error loading user offers:', error);
            this.showNotification('Failed to load your offers', 'error');
        }
    }

    async loadUserDemands() {
        try {
            if (!this.contract || !this.userAddress) return;

            const demandIds = await this.contract.getUserDemands(this.userAddress);
            const demandsList = document.getElementById('userDemandsList');

            if (demandIds.length === 0) {
                demandsList.innerHTML = '<p>No demands found</p>';
                return;
            }

            let demandsHTML = '';
            for (let i = 0; i < demandIds.length; i++) {
                const demandId = demandIds[i];
                const demand = await this.contract.energyDemands(demandId);

                const statusTypes = ['Active', 'Matched', 'Cancelled'];

                demandsHTML += `
                    <div class="demand-item">
                        <h4>Demand #${demandId.toString()}</h4>
                        <p><strong>Status:</strong> ${statusTypes[demand.status]}</p>
                        <p><strong>Private:</strong> ${demand.isPrivate ? 'Yes' : 'No'}</p>
                        <p><strong>Created:</strong> ${new Date(demand.timestamp * 1000).toLocaleString()}</p>
                    </div>
                `;
            }

            demandsList.innerHTML = demandsHTML;

        } catch (error) {
            console.error('Error loading user demands:', error);
            this.showNotification('Failed to load your demands', 'error');
        }
    }

    async loadTradeDetails() {
        try {
            if (!this.contract) {
                this.showNotification('Please connect your wallet first', 'error');
                return;
            }

            const tradeId = parseInt(document.getElementById('tradeId').value);
            if (!tradeId) {
                this.showNotification('Please enter a trade ID', 'error');
                return;
            }

            const tradeDetails = await this.contract.trades(tradeId);
            const tradeDetailsDiv = document.getElementById('tradeDetails');

            const energyTypes = ['Solar', 'Wind', 'Hydro', 'Nuclear'];

            tradeDetailsDiv.innerHTML = `
                <div class="trade-item">
                    <h3>Trade #${tradeId}</h3>
                    <div class="trade-info">
                        <p><strong>Offer ID:</strong> ${tradeDetails.offerId.toString()}</p>
                        <p><strong>Demand ID:</strong> ${tradeDetails.demandId.toString()}</p>
                        <p><strong>Seller:</strong> ${tradeDetails.seller}</p>
                        <p><strong>Buyer:</strong> ${tradeDetails.buyer}</p>
                        <p><strong>Energy Amount:</strong> ${tradeDetails.energyAmount} kWh</p>
                        <p><strong>Trade Price:</strong> ${tradeDetails.tradePrice} wei/kWh</p>
                        <p><strong>Energy Type:</strong> ${energyTypes[tradeDetails.energyType]}</p>
                        <p><strong>Timestamp:</strong> ${new Date(tradeDetails.timestamp * 1000).toLocaleString()}</p>
                        <p><strong>Completed:</strong> ${tradeDetails.completed ? 'Yes' : 'No'}</p>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading trade details:', error);
            this.showNotification('Failed to load trade details', 'error');
        }
    }

    async addCredits() {
        try {
            if (!this.contract) {
                this.showNotification('Please connect your wallet first', 'error');
                return;
            }

            const amount = parseInt(document.getElementById('creditsAmount').value);
            if (!amount || amount <= 0) {
                this.showNotification('Please enter a valid amount', 'error');
                return;
            }

            this.showLoading(true);

            const tx = await this.contract.addCredits(amount, { value: 0 });
            await tx.wait();

            this.showNotification('Credits added successfully!', 'success');
            document.getElementById('creditsAmount').value = '';
            await this.loadUserCredits();

        } catch (error) {
            console.error('Error adding credits:', error);
            this.showNotification('Failed to add credits', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.getElementById('notifications').appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PrivateEnergyMarket();
});