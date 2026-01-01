import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=" .repeat(60));
  console.log("SolCipher Cronos - Smart Contract Deployment");
  console.log("=".repeat(60));

  // Get network
  const network = await ethers.provider.getNetwork();
  console.log(`\nDeploying to network: ${network.name} (Chain ID: ${network.chainId})`);

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} CRO`);

  if (balance === 0n) {
    throw new Error("Deployer has no CRO. Please fund the account first.");
  }

  console.log("\n" + "-".repeat(60));
  console.log("Step 1: Deploying ZKVerifier...");
  console.log("-".repeat(60));

  // Deploy ZKVerifier
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy();
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();

  console.log(`✅ ZKVerifier deployed to: ${zkVerifierAddress}`);

  console.log("\n" + "-".repeat(60));
  console.log("Step 2: Deploying SolCipherCore...");
  console.log("-".repeat(60));

  // Deploy SolCipherCore
  const SolCipherCore = await ethers.getContractFactory("SolCipherCore");
  const solCipherCore = await SolCipherCore.deploy();
  await solCipherCore.waitForDeployment();
  const solCipherCoreAddress = await solCipherCore.getAddress();

  console.log(`✅ SolCipherCore deployed to: ${solCipherCoreAddress}`);

  console.log("\n" + "-".repeat(60));
  console.log("Step 3: Deploying PaymentProcessor...");
  console.log("-".repeat(60));

  // Deploy PaymentProcessor
  const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");
  const feeCollector = deployer.address; // Use deployer as fee collector for now
  const paymentProcessor = await PaymentProcessor.deploy(feeCollector);
  await paymentProcessor.waitForDeployment();
  const paymentProcessorAddress = await paymentProcessor.getAddress();

  console.log(`✅ PaymentProcessor deployed to: ${paymentProcessorAddress}`);

  console.log("\n" + "-".repeat(60));
  console.log("Step 4: Configuring Contracts...");
  console.log("-".repeat(60));

  // Authorize deployer as AI agent in SolCipherCore
  console.log("Authorizing deployer as AI agent...");
  const authTx = await solCipherCore.setAgentAuthorization(deployer.address, true);
  await authTx.wait();
  console.log("✅ Deployer authorized as AI agent");

  // Set SolCipherCore address in PaymentProcessor
  console.log("Setting SolCipherCore address in PaymentProcessor...");
  const setSolCipherTx = await paymentProcessor.setSolCipherCore(solCipherCoreAddress);
  await setSolCipherTx.wait();
  console.log("✅ SolCipherCore linked to PaymentProcessor");

  // Add native token (CRO) support
  console.log("Adding native token (CRO) support...");
  const addTokenTx = await paymentProcessor.setSupportedToken(ethers.ZeroAddress, true);
  await addTokenTx.wait();
  console.log("✅ Native token (CRO) support enabled");

  // Authorize deployer in ZKVerifier
  console.log("Authorizing deployer in ZKVerifier...");
  // Deployer is already authorized in constructor
  console.log("✅ Deployer already authorized in ZKVerifier");

  console.log("\n" + "=".repeat(60));
  console.log("Deployment Summary");
  console.log("=".repeat(60));

  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ZKVerifier: zkVerifierAddress,
      SolCipherCore: solCipherCoreAddress,
      PaymentProcessor: paymentProcessorAddress,
    },
    configuration: {
      feeCollector: feeCollector,
      aiAgent: deployer.address,
    },
  };

  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save deployment info to file
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n✅ Deployment info saved to: ${filepath}`);

  console.log("\n" + "=".repeat(60));
  console.log("Next Steps:");
  console.log("=".repeat(60));
  console.log("1. Update .env file with deployed contract addresses:");
  console.log(`   SOLCIPHER_CORE_ADDRESS=${solCipherCoreAddress}`);
  console.log(`   PAYMENT_PROCESSOR_ADDRESS=${paymentProcessorAddress}`);
  console.log(`   ZK_VERIFIER_ADDRESS=${zkVerifierAddress}`);
  console.log("\n2. Verify contracts on block explorer:");
  console.log(`   npx hardhat verify --network ${network.name} ${zkVerifierAddress}`);
  console.log(`   npx hardhat verify --network ${network.name} ${solCipherCoreAddress}`);
  console.log(`   npx hardhat verify --network ${network.name} ${paymentProcessorAddress} "${feeCollector}"`);
  console.log("\n3. Start the AI agent:");
  console.log("   npm run agent:start");
  console.log("\n4. Test the deployment:");
  console.log("   npm run test");

  console.log("\n" + "=".repeat(60));
  console.log("Deployment Complete! 🎉");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
