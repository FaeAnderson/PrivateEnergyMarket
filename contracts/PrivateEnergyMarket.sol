// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, euint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PrivateEnergyMarket is SepoliaConfig {

    address public owner;
    uint256 public marketSessionId;
    uint256 public sessionStartTime;
    uint256 public sessionDuration = 1 hours;

    enum EnergyType { SOLAR, WIND, HYDRO, NUCLEAR }
    enum OfferStatus { ACTIVE, MATCHED, CANCELLED }

    struct EnergyOffer {
        address seller;
        euint32 energyAmount; // in kWh (encrypted)
        euint32 pricePerKWh; // in wei per kWh (encrypted)
        EnergyType energyType;
        OfferStatus status;
        uint256 timestamp;
        bool isPrivate;
    }

    struct EnergyDemand {
        address buyer;
        euint32 energyNeeded; // in kWh (encrypted)
        euint32 maxPricePerKWh; // in wei per kWh (encrypted)
        OfferStatus status;
        uint256 timestamp;
        bool isPrivate;
    }

    struct Trade {
        uint256 offerId;
        uint256 demandId;
        address seller;
        address buyer;
        uint32 energyAmount; // revealed after trade
        uint32 tradePrice; // revealed after trade
        EnergyType energyType;
        uint256 timestamp;
        bool completed;
    }

    mapping(uint256 => EnergyOffer) public energyOffers;
    mapping(uint256 => EnergyDemand) public energyDemands;
    mapping(uint256 => Trade) public trades;
    mapping(address => uint256[]) public userOffers;
    mapping(address => uint256[]) public userDemands;
    mapping(address => uint256) public userCredits;

    uint256 public nextOfferId = 1;
    uint256 public nextDemandId = 1;
    uint256 public nextTradeId = 1;

    event MarketSessionStarted(uint256 indexed sessionId, uint256 startTime);
    event EnergyOfferCreated(uint256 indexed offerId, address indexed seller, EnergyType energyType);
    event EnergyDemandCreated(uint256 indexed demandId, address indexed buyer);
    event TradeMatched(uint256 indexed tradeId, uint256 indexed offerId, uint256 indexed demandId);
    event TradeCompleted(uint256 indexed tradeId, address indexed seller, address indexed buyer, uint32 amount, uint32 price);
    event OfferCancelled(uint256 indexed offerId, address indexed seller);
    event DemandCancelled(uint256 indexed demandId, address indexed buyer);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyDuringMarketHours() {
        require(isMarketActive(), "Market is closed");
        _;
    }

    constructor() {
        owner = msg.sender;
        marketSessionId = 1;
        sessionStartTime = block.timestamp;
    }

    function isMarketActive() public view returns (bool) {
        return (block.timestamp - sessionStartTime) <= sessionDuration;
    }

    function startNewMarketSession() external onlyOwner {
        require(!isMarketActive(), "Market session still active");
        marketSessionId++;
        sessionStartTime = block.timestamp;
        emit MarketSessionStarted(marketSessionId, sessionStartTime);
    }

    // Create private energy offer
    function createEnergyOffer(
        uint32 _energyAmount,
        uint32 _pricePerKWh,
        EnergyType _energyType,
        bool _isPrivate
    ) external onlyDuringMarketHours {
        require(_energyAmount > 0, "Energy amount must be positive");
        require(_pricePerKWh > 0, "Price must be positive");

        euint32 encryptedAmount = FHE.asEuint32(_energyAmount);
        euint32 encryptedPrice = FHE.asEuint32(_pricePerKWh);

        energyOffers[nextOfferId] = EnergyOffer({
            seller: msg.sender,
            energyAmount: encryptedAmount,
            pricePerKWh: encryptedPrice,
            energyType: _energyType,
            status: OfferStatus.ACTIVE,
            timestamp: block.timestamp,
            isPrivate: _isPrivate
        });

        userOffers[msg.sender].push(nextOfferId);

        // Set access permissions
        FHE.allowThis(encryptedAmount);
        FHE.allowThis(encryptedPrice);
        if (!_isPrivate) {
            FHE.allow(encryptedAmount, address(0)); // Public visibility
            FHE.allow(encryptedPrice, address(0));
        } else {
            FHE.allow(encryptedAmount, msg.sender);
            FHE.allow(encryptedPrice, msg.sender);
        }

        emit EnergyOfferCreated(nextOfferId, msg.sender, _energyType);
        nextOfferId++;
    }

    // Create private energy demand
    function createEnergyDemand(
        uint32 _energyNeeded,
        uint32 _maxPricePerKWh,
        bool _isPrivate
    ) external onlyDuringMarketHours {
        require(_energyNeeded > 0, "Energy needed must be positive");
        require(_maxPricePerKWh > 0, "Max price must be positive");

        euint32 encryptedNeeded = FHE.asEuint32(_energyNeeded);
        euint32 encryptedMaxPrice = FHE.asEuint32(_maxPricePerKWh);

        energyDemands[nextDemandId] = EnergyDemand({
            buyer: msg.sender,
            energyNeeded: encryptedNeeded,
            maxPricePerKWh: encryptedMaxPrice,
            status: OfferStatus.ACTIVE,
            timestamp: block.timestamp,
            isPrivate: _isPrivate
        });

        userDemands[msg.sender].push(nextDemandId);

        // Set access permissions
        FHE.allowThis(encryptedNeeded);
        FHE.allowThis(encryptedMaxPrice);
        if (!_isPrivate) {
            FHE.allow(encryptedNeeded, address(0)); // Public visibility
            FHE.allow(encryptedMaxPrice, address(0));
        } else {
            FHE.allow(encryptedNeeded, msg.sender);
            FHE.allow(encryptedMaxPrice, msg.sender);
        }

        emit EnergyDemandCreated(nextDemandId, msg.sender);
        nextDemandId++;
    }

    // Match offer with demand (simplified matching)
    function matchTrade(uint256 _offerId, uint256 _demandId) external onlyDuringMarketHours {
        require(_offerId < nextOfferId && _demandId < nextDemandId, "Invalid IDs");

        EnergyOffer storage offer = energyOffers[_offerId];
        EnergyDemand storage demand = energyDemands[_demandId];

        require(offer.status == OfferStatus.ACTIVE, "Offer not active");
        require(demand.status == OfferStatus.ACTIVE, "Demand not active");
        require(offer.seller != demand.buyer, "Cannot trade with yourself");

        // Check if buyer has permission to see offer details (if private)
        require(!offer.isPrivate || msg.sender == demand.buyer || msg.sender == offer.seller, "No access to private offer");
        require(!demand.isPrivate || msg.sender == demand.buyer || msg.sender == offer.seller, "No access to private demand");

        // Create trade entry for async processing
        trades[nextTradeId] = Trade({
            offerId: _offerId,
            demandId: _demandId,
            seller: offer.seller,
            buyer: demand.buyer,
            energyAmount: 0, // Will be set after decryption
            tradePrice: 0,   // Will be set after decryption
            energyType: offer.energyType,
            timestamp: block.timestamp,
            completed: false
        });

        // Update status
        offer.status = OfferStatus.MATCHED;
        demand.status = OfferStatus.MATCHED;

        // Request decryption for trade processing
        bytes32[] memory cts = new bytes32[](4);
        cts[0] = FHE.toBytes32(offer.energyAmount);
        cts[1] = FHE.toBytes32(offer.pricePerKWh);
        cts[2] = FHE.toBytes32(demand.energyNeeded);
        cts[3] = FHE.toBytes32(demand.maxPricePerKWh);

        FHE.requestDecryption(cts, this.processTradeMatch.selector);

        emit TradeMatched(nextTradeId, _offerId, _demandId);
        nextTradeId++;
    }

    // Process trade after decryption
    function processTradeMatch(
        uint256 requestId,
        uint32 offerAmount,
        uint32 offerPrice,
        uint32 demandAmount,
        uint32 demandMaxPrice,
        bytes memory signatures
    ) external {
        // Encode the decrypted values as cleartexts
        bytes memory cleartexts = abi.encode(offerAmount, offerPrice, demandAmount, demandMaxPrice);

        // Verify signatures
        FHE.checkSignatures(requestId, cleartexts, signatures);

        uint256 tradeId = nextTradeId - 1; // Last created trade
        Trade storage trade = trades[tradeId];

        // Validate trade conditions
        require(offerPrice <= demandMaxPrice, "Price mismatch");

        // Calculate trade amount (minimum of offer and demand)
        uint32 tradeAmount = offerAmount < demandAmount ? offerAmount : demandAmount;
        uint32 finalPrice = offerPrice;

        // Update trade details
        trade.energyAmount = tradeAmount;
        trade.tradePrice = finalPrice;
        trade.completed = true;

        // Calculate payment
        uint256 totalPayment = uint256(tradeAmount) * uint256(finalPrice);

        // Transfer credits (simplified - in real implementation would use actual payments)
        require(userCredits[trade.buyer] >= totalPayment, "Insufficient credits");
        userCredits[trade.buyer] -= totalPayment;
        userCredits[trade.seller] += totalPayment;

        emit TradeCompleted(tradeId, trade.seller, trade.buyer, tradeAmount, finalPrice);
    }

    // Cancel energy offer
    function cancelOffer(uint256 _offerId) external {
        require(_offerId < nextOfferId, "Invalid offer ID");
        EnergyOffer storage offer = energyOffers[_offerId];
        require(offer.seller == msg.sender, "Not your offer");
        require(offer.status == OfferStatus.ACTIVE, "Offer not active");

        offer.status = OfferStatus.CANCELLED;
        emit OfferCancelled(_offerId, msg.sender);
    }

    // Cancel energy demand
    function cancelDemand(uint256 _demandId) external {
        require(_demandId < nextDemandId, "Invalid demand ID");
        EnergyDemand storage demand = energyDemands[_demandId];
        require(demand.buyer == msg.sender, "Not your demand");
        require(demand.status == OfferStatus.ACTIVE, "Demand not active");

        demand.status = OfferStatus.CANCELLED;
        emit DemandCancelled(_demandId, msg.sender);
    }

    // Add credits to user account (for testing/demo purposes)
    function addCredits(uint256 _amount) external payable {
        userCredits[msg.sender] += _amount;
    }

    // Get user's offers
    function getUserOffers(address _user) external view returns (uint256[] memory) {
        return userOffers[_user];
    }

    // Get user's demands
    function getUserDemands(address _user) external view returns (uint256[] memory) {
        return userDemands[_user];
    }

    // Get market session info
    function getMarketSessionInfo() external view returns (
        uint256 sessionId,
        uint256 startTime,
        bool isActive,
        uint256 totalOffers,
        uint256 totalDemands
    ) {
        return (
            marketSessionId,
            sessionStartTime,
            isMarketActive(),
            nextOfferId - 1,
            nextDemandId - 1
        );
    }

    // Get trade details
    function getTradeDetails(uint256 _tradeId) external view returns (
        address seller,
        address buyer,
        uint32 energyAmount,
        uint32 tradePrice,
        EnergyType energyType,
        bool completed
    ) {
        require(_tradeId < nextTradeId, "Invalid trade ID");
        Trade storage trade = trades[_tradeId];
        return (
            trade.seller,
            trade.buyer,
            trade.energyAmount,
            trade.tradePrice,
            trade.energyType,
            trade.completed
        );
    }

    // Emergency function to set session duration
    function setSessionDuration(uint256 _duration) external onlyOwner {
        sessionDuration = _duration;
    }
}