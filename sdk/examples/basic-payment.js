/**
 * SolCipher SDK - Basic Payment Example
 * 
 * This example demonstrates how to:
 * 1. Initialize SolCipher SDK
 * 2. Create an encrypted payment
 * 3. Assess risk with AI
 * 4. Execute the payment
 */

require('dotenv').config();
const { SolCipher } = require('../sdk/solcipher');

async function main() {
  console.log('='.repeat(60));
  console.log('SolCipher - Basic Private Payment Example');
  console.log('='.repeat(60));
  
  // Initialize SolCipher
  const solcipher = new SolCipher({
    network: 'cronos-testnet',
    privateKey: process.env.PRIVATE_KEY,
    aiAgentKey: process.env.AI_AGENT_API_KEY
  });
  
  console.log('\n✅ SolCipher SDK initialized');
  console.log(`Network: ${solcipher.network}`);
  console.log(`Chain ID: ${solcipher.chainId}`);
  
  // Step 1: Create payment data
  const payment = {
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    amount: '100',
    token: 'CRO',
    metadata: {
      purpose: 'Invoice Payment',
      invoiceId: 'INV-2024-001',
      date: new Date().toISOString()
    }
  };
  
  console.log('\n' + '-'.repeat(60));
  console.log('Step 1: Payment Details');
  console.log('-'.repeat(60));
  console.log(`Recipient: ${payment.recipient}`);
  console.log(`Amount: ${payment.amount} ${payment.token}`);
  console.log(`Purpose: ${payment.metadata.purpose}`);
  
  // Step 2: Encrypt payment
  console.log('\n' + '-'.repeat(60));
  console.log('Step 2: Encrypting Payment Data');
  console.log('-'.repeat(60));
  
  const encryptedPayment = await solcipher.encryptPayment(payment);
  
  console.log('✅ Payment data encrypted');
  console.log(`Recipient Hash: ${encryptedPayment.recipientHash}`);
  console.log(`Encrypted Amount: ${encryptedPayment.encryptedAmount.substring(0, 20)}...`);
  console.log(`Encrypted Metadata: ${encryptedPayment.encryptedMetadata.substring(0, 20)}...`);
  
  // Step 3: Assess risk
  console.log('\n' + '-'.repeat(60));
  console.log('Step 3: AI Risk Assessment');
  console.log('-'.repeat(60));
  
  const riskScore = await solcipher.assessRisk({
    sender: solcipher.wallet.address,
    recipient: payment.recipient,
    amount: payment.amount,
    token: payment.token
  });
  
  console.log(`✅ Risk Score: ${riskScore}/100`);
  
  if (riskScore > 80) {
    console.log('⚠️  HIGH RISK - Additional verification recommended');
  } else if (riskScore > 50) {
    console.log('⚠️  MEDIUM RISK - Standard verification applied');
  } else {
    console.log('✅ LOW RISK - Payment approved');
  }
  
  // Step 4: Execute payment
  console.log('\n' + '-'.repeat(60));
  console.log('Step 4: Executing Private Payment');
  console.log('-'.repeat(60));
  
  try {
    const tx = await solcipher.executePrivatePayment(encryptedPayment);
    
    console.log('✅ Payment executed successfully!');
    console.log(`Transaction Hash: ${tx.hash}`);
    console.log(`Payment ID: ${tx.paymentId}`);
    console.log(`Block Number: ${tx.blockNumber}`);
    
    // Wait a moment for indexing
    console.log('\nWaiting for blockchain confirmation...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get payment details
    if (tx.paymentId) {
      console.log('\n' + '-'.repeat(60));
      console.log('Step 5: Verify Payment Status');
      console.log('-'.repeat(60));
      
      const paymentDetails = await solcipher.getPayment(tx.paymentId);
      
      console.log('Payment Details:');
      console.log(`  Sender: ${paymentDetails.sender}`);
      console.log(`  Status: ${paymentDetails.status}`);
      console.log(`  Risk Score: ${paymentDetails.riskScore}/100`);
      console.log(`  Timestamp: ${new Date(paymentDetails.timestamp * 1000).toLocaleString()}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Example completed successfully!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Error executing payment:');
    console.error(error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log('\n💡 Tip: Make sure your wallet has enough CRO for gas fees');
      console.log('   Get testnet CRO from: https://cronos.org/faucet');
    }
  }
}

// Run the example
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
