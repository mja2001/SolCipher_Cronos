/**
 * SolCipher SDK - JavaScript/TypeScript SDK for privacy-preserving payments
 * @module solcipher
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

/**
 * Main SolCipher SDK class
 */
class SolCipher {
  /**
   * Initialize SolCipher SDK
   * @param {Object} config - Configuration object
   * @param {string} config.network - Network name ('cronos-testnet' or 'cronos-mainnet')
   * @param {string} config.privateKey - Private key for signing transactions
   * @param {string} config.aiAgentKey - AI Agent API key
   * @param {string} [config.rpcUrl] - Custom RPC URL
   */
  constructor(config) {
    this.config = config;
    this.network = config.network || 'cronos-testnet';
    this.aiAgentKey = config.aiAgentKey;
    
    // Network configuration
    const networks = {
      'cronos-testnet': {
        rpcUrl: 'https://evm-t3.cronos.org',
        chainId: 338,
        contracts: {
          solCipherCore: process.env.SOLCIPHER_CORE_ADDRESS,
          paymentProcessor: process.env.PAYMENT_PROCESSOR_ADDRESS,
          zkVerifier: process.env.ZK_VERIFIER_ADDRESS
        }
      },
      'cronos-mainnet': {
        rpcUrl: 'https://evm.cronos.org',
        chainId: 25,
        contracts: {
          solCipherCore: process.env.SOLCIPHER_CORE_MAINNET_ADDRESS,
          paymentProcessor: process.env.PAYMENT_PROCESSOR_MAINNET_ADDRESS,
          zkVerifier: process.env.ZK_VERIFIER_MAINNET_ADDRESS
        }
      }
    };
    
    const networkConfig = networks[this.network];
    if (!networkConfig) {
      throw new Error(`Unsupported network: ${this.network}`);
    }
    
    // Setup provider and signer
    const rpcUrl = config.rpcUrl || networkConfig.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    if (config.privateKey) {
      this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    }
    
    this.contracts = networkConfig.contracts;
    this.chainId = networkConfig.chainId;
    
    // Initialize contract instances
    this._initContracts();
  }
  
  /**
   * Initialize contract instances
   * @private
   */
  _initContracts() {
    // Simplified ABIs (in production, load from JSON files)
    const solCipherCoreABI = [
      'function createEncryptedPayment(bytes32 recipientHash, bytes encryptedAmount, bytes encryptedMetadata) returns (bytes32)',
      'function getPayment(bytes32 paymentId) view returns (tuple(address sender, bytes32 recipientHash, bytes encryptedAmount, bytes encryptedMetadata, uint256 timestamp, uint8 status, uint256 riskScore))',
      'function completePayment(bytes32 paymentId)',
      'function setPrivacySettings(bool zkEnabled, bool aiCheckEnabled, uint256 minRiskThreshold, bool metadataEncryption)'
    ];
    
    if (this.wallet && this.contracts.solCipherCore) {
      this.solCipherCore = new ethers.Contract(
        this.contracts.solCipherCore,
        solCipherCoreABI,
        this.wallet
      );
    }
  }
  
  /**
   * Encrypt payment data
   * @param {Object} payment - Payment object
   * @param {string} payment.recipient - Recipient address
   * @param {string} payment.amount - Payment amount
   * @param {string} payment.token - Token symbol (CRO, USDC, etc.)
   * @param {Object} [payment.metadata] - Additional metadata
   * @returns {Promise<Object>} Encrypted payment data
   */
  async encryptPayment(payment) {
    if (!payment.recipient || !payment.amount) {
      throw new Error('Recipient and amount are required');
    }
    
    // Hash recipient address for privacy
    const recipientHash = ethers.keccak256(
      ethers.toUtf8Bytes(payment.recipient)
    );
    
    // Encrypt amount
    const encryptedAmount = this._encrypt({
      amount: payment.amount,
      token: payment.token || 'CRO'
    });
    
    // Encrypt metadata
    const encryptedMetadata = this._encrypt(
      payment.metadata || { timestamp: Date.now() }
    );
    
    return {
      recipientHash,
      encryptedAmount: ethers.hexlify(encryptedAmount),
      encryptedMetadata: ethers.hexlify(encryptedMetadata),
      original: payment
    };
  }
  
  /**
   * Execute a private payment
   * @param {Object} encryptedPayment - Encrypted payment data from encryptPayment()
   * @returns {Promise<Object>} Transaction receipt
   */
  async executePrivatePayment(encryptedPayment) {
    if (!this.solCipherCore) {
      throw new Error('SolCipher contract not initialized');
    }
    
    const tx = await this.solCipherCore.createEncryptedPayment(
      encryptedPayment.recipientHash,
      encryptedPayment.encryptedAmount,
      encryptedPayment.encryptedMetadata
    );
    
    const receipt = await tx.wait();
    
    // Extract payment ID from event
    const event = receipt.logs.find(
      log => log.topics[0] === ethers.id('PaymentEncrypted(bytes32,address,bytes32,uint256)')
    );
    
    const paymentId = event ? event.topics[1] : null;
    
    return {
      hash: receipt.hash,
      paymentId,
      blockNumber: receipt.blockNumber,
      status: receipt.status
    };
  }
  
  /**
   * Assess transaction risk using AI
   * @param {Object} transaction - Transaction details
   * @returns {Promise<number>} Risk score (0-100)
   */
  async assessRisk(transaction) {
    if (!this.aiAgentKey) {
      throw new Error('AI Agent API key not configured');
    }
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.aiAgentKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Analyze this blockchain transaction for risk (0-100 scale):
              
Sender: ${transaction.sender}
Recipient: ${transaction.recipient}
Amount: ${transaction.amount} ${transaction.token || 'CRO'}

Respond with ONLY a JSON object: {"risk_score": <number>, "factors": ["<factor1>", "<factor2>"]}` 
          }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }
      
      const data = await response.json();
      const content = data.content[0].text;
      
      // Parse JSON response
      const result = JSON.parse(content.replace(/```json|```/g, '').trim());
      
      return result.risk_score || 50;
      
    } catch (error) {
      console.error('Risk assessment error:', error);
      return 50; // Default medium risk on error
    }
  }
  
  /**
   * Enable enhanced privacy mode
   * @returns {Promise<Object>} Transaction receipt
   */
  async enableEnhancedPrivacy() {
    if (!this.solCipherCore) {
      throw new Error('SolCipher contract not initialized');
    }
    
    const tx = await this.solCipherCore.setPrivacySettings(
      true,  // ZK proofs enabled
      true,  // AI risk check enabled
      80,    // Higher risk threshold
      true   // Metadata encryption required
    );
    
    return await tx.wait();
  }
  
  /**
   * Get payment details
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPayment(paymentId) {
    if (!this.solCipherCore) {
      throw new Error('SolCipher contract not initialized');
    }
    
    const payment = await this.solCipherCore.getPayment(paymentId);
    
    return {
      sender: payment.sender,
      recipientHash: payment.recipientHash,
      timestamp: Number(payment.timestamp),
      status: this._getStatusName(payment.status),
      riskScore: Number(payment.riskScore)
    };
  }
  
  /**
   * Complete a payment
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Transaction receipt
   */
  async completePayment(paymentId) {
    if (!this.solCipherCore) {
      throw new Error('SolCipher contract not initialized');
    }
    
    const tx = await this.solCipherCore.completePayment(paymentId);
    return await tx.wait();
  }
  
  /**
   * Create x402 payment with privacy
   * @param {Object} payment - Payment details
   * @returns {Promise<Object>} Payment object with execute method
   */
  x402 = {
    createPayment: async (payment) => {
      const encryptedPayment = await this.encryptPayment(payment);
      
      return {
        id: ethers.hexlify(ethers.randomBytes(32)),
        ...encryptedPayment,
        execute: async () => {
          return await this.executePrivatePayment(encryptedPayment);
        }
      };
    }
  };
  
  /**
   * Encrypt data using AES-256-GCM
   * @private
   * @param {Object} data - Data to encrypt
   * @returns {Buffer} Encrypted data
   */
  _encrypt(data) {
    const key = crypto.randomBytes(32); // In production, use proper key management
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const plaintext = JSON.stringify(data);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine: iv + authTag + encrypted
    return Buffer.concat([iv, authTag, encrypted]);
  }
  
  /**
   * Get human-readable status name
   * @private
   * @param {number} status - Status code
   * @returns {string} Status name
   */
  _getStatusName(status) {
    const statuses = ['Pending', 'Verified', 'Completed', 'Failed', 'Flagged'];
    return statuses[status] || 'Unknown';
  }
}

module.exports = { SolCipher };
