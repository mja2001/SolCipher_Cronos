// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PaymentProcessor
 * @dev Processes x402 payments with privacy features
 */
contract PaymentProcessor is Ownable, ReentrancyGuard, Pausable {
    
    struct Payment {
        address token;
        address sender;
        address recipient;
        uint256 amount;
        bytes32 encryptedDetails;
        PaymentStatus status;
        uint256 timestamp;
    }
    
    enum PaymentStatus {
        Pending,
        Processing,
        Completed,
        Failed,
        Refunded
    }
    
    // State variables
    mapping(bytes32 => Payment) public payments;
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public processingFees; // Fee per token
    
    address public feeCollector;
    address public solCipherCore;
    uint256 public defaultFeePercentage = 10; // 0.1% (10/10000)
    
    // Events
    event PaymentCreated(
        bytes32 indexed paymentId,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount
    );
    
    event PaymentProcessed(
        bytes32 indexed paymentId,
        PaymentStatus status
    );
    
    event PaymentCompleted(
        bytes32 indexed paymentId,
        address indexed recipient,
        uint256 amount
    );
    
    event TokenSupported(address indexed token, bool supported);
    event FeeUpdated(address indexed token, uint256 fee);
    
    // Modifiers
    modifier onlySolCipher() {
        require(msg.sender == solCipherCore, "Only SolCipher can call");
        _;
    }
    
    constructor(address _feeCollector) Ownable(msg.sender) {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
    }
    
    /**
     * @dev Set SolCipher core contract address
     */
    function setSolCipherCore(address _solCipherCore) external onlyOwner {
        require(_solCipherCore != address(0), "Invalid address");
        solCipherCore = _solCipherCore;
    }
    
    /**
     * @dev Create a new payment
     */
    function createPayment(
        address token,
        address recipient,
        uint256 amount,
        bytes32 encryptedDetails
    ) external payable nonReentrant whenNotPaused returns (bytes32) {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(supportedTokens[token], "Token not supported");
        
        bytes32 paymentId = keccak256(
            abi.encodePacked(
                msg.sender,
                recipient,
                token,
                amount,
                block.timestamp,
                block.number
            )
        );
        
        // Transfer tokens to contract
        if (token == address(0)) {
            // Native token (CRO)
            require(msg.value == amount, "Incorrect amount sent");
        } else {
            // ERC20 token
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }
        
        // Store payment
        payments[paymentId] = Payment({
            token: token,
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            encryptedDetails: encryptedDetails,
            status: PaymentStatus.Pending,
            timestamp: block.timestamp
        });
        
        emit PaymentCreated(paymentId, msg.sender, recipient, token, amount);
        
        return paymentId;
    }
    
    /**
     * @dev Process payment after verification
     */
    function processPayment(
        bytes32 paymentId
    ) external onlySolCipher nonReentrant {
        Payment storage payment = payments[paymentId];
        require(payment.sender != address(0), "Payment not found");
        require(
            payment.status == PaymentStatus.Pending,
            "Payment already processed"
        );
        
        payment.status = PaymentStatus.Processing;
        
        emit PaymentProcessed(paymentId, PaymentStatus.Processing);
    }
    
    /**
     * @dev Complete payment and transfer funds
     */
    function completePayment(
        bytes32 paymentId
    ) external onlySolCipher nonReentrant {
        Payment storage payment = payments[paymentId];
        require(payment.sender != address(0), "Payment not found");
        require(
            payment.status == PaymentStatus.Processing,
            "Payment not in processing state"
        );
        
        // Calculate fee
        uint256 fee = _calculateFee(payment.token, payment.amount);
        uint256 amountAfterFee = payment.amount - fee;
        
        // Transfer to recipient
        if (payment.token == address(0)) {
            // Native token
            (bool success, ) = payment.recipient.call{value: amountAfterFee}("");
            require(success, "Transfer failed");
            
            if (fee > 0) {
                (bool feeSuccess, ) = feeCollector.call{value: fee}("");
                require(feeSuccess, "Fee transfer failed");
            }
        } else {
            // ERC20 token
            IERC20(payment.token).transfer(payment.recipient, amountAfterFee);
            
            if (fee > 0) {
                IERC20(payment.token).transfer(feeCollector, fee);
            }
        }
        
        payment.status = PaymentStatus.Completed;
        
        emit PaymentCompleted(paymentId, payment.recipient, amountAfterFee);
    }
    
    /**
     * @dev Refund payment if verification fails
     */
    function refundPayment(
        bytes32 paymentId,
        string calldata reason
    ) external onlySolCipher nonReentrant {
        Payment storage payment = payments[paymentId];
        require(payment.sender != address(0), "Payment not found");
        require(
            payment.status == PaymentStatus.Pending ||
            payment.status == PaymentStatus.Processing,
            "Cannot refund completed payment"
        );
        
        // Refund to sender
        if (payment.token == address(0)) {
            (bool success, ) = payment.sender.call{value: payment.amount}("");
            require(success, "Refund failed");
        } else {
            IERC20(payment.token).transfer(payment.sender, payment.amount);
        }
        
        payment.status = PaymentStatus.Refunded;
        
        emit PaymentProcessed(paymentId, PaymentStatus.Refunded);
    }
    
    /**
     * @dev Calculate processing fee
     */
    function _calculateFee(
        address token,
        uint256 amount
    ) internal view returns (uint256) {
        uint256 feePercentage = processingFees[token];
        
        if (feePercentage == 0) {
            feePercentage = defaultFeePercentage;
        }
        
        return (amount * feePercentage) / 10000;
    }
    
    /**
     * @dev Add or remove supported token
     */
    function setSupportedToken(
        address token,
        bool supported
    ) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }
    
    /**
     * @dev Set processing fee for specific token
     */
    function setProcessingFee(
        address token,
        uint256 feePercentage
    ) external onlyOwner {
        require(feePercentage <= 1000, "Fee too high"); // Max 10%
        processingFees[token] = feePercentage;
        emit FeeUpdated(token, feePercentage);
    }
    
    /**
     * @dev Set default fee percentage
     */
    function setDefaultFeePercentage(
        uint256 feePercentage
    ) external onlyOwner {
        require(feePercentage <= 1000, "Fee too high");
        defaultFeePercentage = feePercentage;
    }
    
    /**
     * @dev Update fee collector address
     */
    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
    }
    
    /**
     * @dev Get payment details
     */
    function getPayment(
        bytes32 paymentId
    ) external view returns (Payment memory) {
        return payments[paymentId];
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "Withdrawal failed");
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }
    
    receive() external payable {}
}
