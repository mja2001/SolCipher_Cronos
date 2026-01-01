# SolCipher Cronos - Setup Guide

This guide will help you set up and run SolCipher locally for development and testing.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18+ and npm
- **Python** 3.9+
- **Git**
- A **Cronos testnet wallet** with CRO tokens
- **Crypto.com AI Agent SDK** access (API key)

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/solcipher-cronos.git
cd solcipher-cronos
```

## Step 2: Install Dependencies

### JavaScript/TypeScript Dependencies

```bash
npm install
```

### Python Dependencies

```bash
cd agent
pip install -r requirements.txt
cd ..
```

## Step 3: Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:

```env
# Cronos Network
CRONOS_RPC_URL=https://evm-t3.cronos.org
CRONOS_CHAIN_ID=338

# Your Wallet
PRIVATE_KEY=your_private_key_without_0x
DEPLOYER_ADDRESS=0xYourAddress

# AI Agent (Get from Crypto.com)
AI_AGENT_API_KEY=your_api_key
AI_MODEL_ENDPOINT=https://api.crypto.com/ai-agent/v1

# x402 Integration
X402_PAYMENT_GATEWAY=https://x402.crypto.com/api
X402_MERCHANT_ID=your_merchant_id
X402_API_KEY=your_x402_key

# Encryption
ENCRYPTION_ALGORITHM=AES-256-GCM
ZK_PROOF_SYSTEM=Groth16
```

## Step 4: Get Testnet CRO

1. Visit [Cronos Testnet Faucet](https://cronos.org/faucet)
2. Enter your wallet address
3. Request testnet CRO tokens
4. Wait for tokens to arrive (usually < 1 minute)

## Step 5: Compile Smart Contracts

```bash
npm run build
```

This will:
- Compile Solidity contracts
- Generate TypeScript types
- Prepare the project for deployment

## Step 6: Deploy to Cronos Testnet

```bash
npm run deploy:testnet
```

The deployment script will:
1. Deploy ZKVerifier contract
2. Deploy SolCipherCore contract
3. Deploy PaymentProcessor contract
4. Configure contract permissions
5. Save deployment addresses

**Important:** After deployment, copy the contract addresses and update your `.env` file:

```env
SOLCIPHER_CORE_ADDRESS=0x...
PAYMENT_PROCESSOR_ADDRESS=0x...
ZK_VERIFIER_ADDRESS=0x...
```

## Step 7: Verify Contracts (Optional)

Verify your contracts on the Cronos block explorer:

```bash
npx hardhat verify --network cronosTestnet <CONTRACT_ADDRESS>
```

## Step 8: Run Tests

### Smart Contract Tests

```bash
npm run test:contracts
```

### AI Agent Tests

```bash
npm run test:agent
```

### All Tests

```bash
npm test
```

## Step 9: Start the AI Agent

```bash
npm run agent:start
```

You should see output like:

```
============================================================
SolCipher AI Agent - Privacy Layer for Cronos
============================================================
SolCipher AI Agent initialized
Starting SolCipher AI Agent...
Starting payment monitor...
Starting risk assessment processor...
Starting encryption handler...
Starting autonomous decision executor...
```

## Step 10: Run the Demo Application

In a new terminal:

```bash
npm run demo
```

This will start the frontend demo application at `http://localhost:3000`

## Troubleshooting

### Issue: "Insufficient funds for gas"

**Solution:** Request more testnet CRO from the faucet.

### Issue: "Contract deployment failed"

**Solution:** 
1. Check your RPC URL is correct
2. Ensure you have enough testnet CRO
3. Verify your private key is correct (without 0x prefix)

### Issue: "AI Agent API error"

**Solution:**
1. Verify your AI_AGENT_API_KEY is valid
2. Check the API endpoint URL
3. Ensure you have internet connectivity

### Issue: "Python module not found"

**Solution:**
```bash
cd agent
pip install -r requirements.txt --upgrade
```

### Issue: "Web3 connection error"

**Solution:**
1. Verify the Cronos RPC URL is accessible
2. Try an alternative RPC endpoint:
   - `https://evm-t3.cronos.org`
   - `https://cronos-testnet.publicnode.com`

## Development Workflow

### Making Changes to Smart Contracts

1. Edit contracts in `contracts/` directory
2. Recompile: `npm run build`
3. Redeploy: `npm run deploy:testnet`
4. Update contract addresses in `.env`
5. Restart AI agent

### Making Changes to AI Agent

1. Edit Python files in `agent/` directory
2. Restart the agent: `npm run agent:start`
3. Run tests: `npm run test:agent`

### Running in Production

For mainnet deployment:

1. Update `.env` with mainnet configuration:
   ```env
   CRONOS_RPC_URL=https://evm.cronos.org
   CRONOS_CHAIN_ID=25
   ```

2. Deploy to mainnet:
   ```bash
   npm run deploy:mainnet
   ```

3. **Important:** Use a secure key management solution (HSM, KMS) for mainnet private keys

## Next Steps

- [Read the Architecture Documentation](./ARCHITECTURE.md)
- [Check the API Reference](./API.md)
- [View Code Examples](../examples/)
- [Join our Discord](https://discord.gg/solcipher)

## Getting Help

- **GitHub Issues:** [Report bugs or request features](https://github.com/yourusername/solcipher-cronos/issues)
- **Discord:** [Join our community](https://discord.gg/solcipher)
- **Email:** team@solcipher.dev

## Security Notice

⚠️ **Never commit your `.env` file or share your private keys!**

For production use:
- Use hardware wallets or key management systems
- Enable multi-signature requirements
- Implement rate limiting
- Set up monitoring and alerts
- Conduct security audits

---

Happy building with SolCipher! 🔐🚀
