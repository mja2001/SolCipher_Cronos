"""
SolCipher AI Agent - Main Entry Point
Autonomous agent for privacy-preserving transaction management on Cronos
"""

import asyncio
import os
import logging
from typing import Dict, Any
from dotenv import load_dotenv

from risk_analyzer import RiskAnalyzer
from encryption_manager import EncryptionManager
from decision_engine import DecisionEngine

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/agent.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class SolCipherAgent:
    """Main AI Agent for SolCipher privacy operations"""
    
    def __init__(self):
        """Initialize the SolCipher AI Agent"""
        self.config = self._load_config()
        self.risk_analyzer = RiskAnalyzer(self.config)
        self.encryption_manager = EncryptionManager(self.config)
        self.decision_engine = DecisionEngine(self.config)
        self.is_running = False
        
        logger.info("SolCipher AI Agent initialized")
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from environment variables"""
        return {
            'cronos_rpc_url': os.getenv('CRONOS_RPC_URL'),
            'ai_agent_api_key': os.getenv('AI_AGENT_API_KEY'),
            'ai_model_endpoint': os.getenv('AI_MODEL_ENDPOINT'),
            'risk_threshold': float(os.getenv('AI_RISK_THRESHOLD', '0.75')),
            'update_interval': int(os.getenv('AI_UPDATE_INTERVAL', '5000')),
            'contract_address': os.getenv('SOLCIPHER_CORE_ADDRESS'),
            'private_key': os.getenv('PRIVATE_KEY'),
            'x402_api_key': os.getenv('X402_API_KEY'),
            'encryption_algorithm': os.getenv('ENCRYPTION_ALGORITHM', 'AES-256-GCM'),
        }
    
    async def start(self):
        """Start the AI agent"""
        self.is_running = True
        logger.info("Starting SolCipher AI Agent...")
        
        try:
            # Start monitoring tasks
            await asyncio.gather(
                self._monitor_payments(),
                self._process_risk_assessments(),
                self._handle_encryption_requests(),
                self._execute_autonomous_decisions()
            )
        except KeyboardInterrupt:
            logger.info("Shutting down gracefully...")
            await self.stop()
        except Exception as e:
            logger.error(f"Error in agent execution: {e}")
            await self.stop()
    
    async def stop(self):
        """Stop the AI agent"""
        self.is_running = False
        logger.info("SolCipher AI Agent stopped")
    
    async def _monitor_payments(self):
        """Monitor blockchain for new payment events"""
        logger.info("Starting payment monitor...")
        
        while self.is_running:
            try:
                # Listen for new encrypted payment events
                events = await self.decision_engine.get_pending_payments()
                
                for event in events:
                    logger.info(f"New payment detected: {event['payment_id']}")
                    await self._process_payment(event)
                
                await asyncio.sleep(self.config['update_interval'] / 1000)
                
            except Exception as e:
                logger.error(f"Error monitoring payments: {e}")
                await asyncio.sleep(5)
    
    async def _process_payment(self, payment_data: Dict[str, Any]):
        """Process a new payment with AI analysis"""
        try:
            payment_id = payment_data['payment_id']
            logger.info(f"Processing payment {payment_id}")
            
            # Step 1: Decrypt payment data (if authorized)
            decrypted_data = await self.encryption_manager.decrypt_payment_data(
                payment_data['encrypted_amount'],
                payment_data['encrypted_metadata']
            )
            
            # Step 2: Perform risk analysis
            risk_score = await self.risk_analyzer.analyze_transaction(
                sender=payment_data['sender'],
                recipient_hash=payment_data['recipient_hash'],
                amount=decrypted_data['amount'],
                metadata=decrypted_data['metadata']
            )
            
            logger.info(f"Risk score for {payment_id}: {risk_score}")
            
            # Step 3: Update risk score on blockchain
            await self.decision_engine.update_payment_risk_score(
                payment_id,
                risk_score
            )
            
            # Step 4: Make autonomous decision
            decision = await self.decision_engine.make_decision(
                payment_id,
                risk_score,
                decrypted_data
            )
            
            logger.info(f"Decision for {payment_id}: {decision}")
            
        except Exception as e:
            logger.error(f"Error processing payment: {e}")
    
    async def _process_risk_assessments(self):
        """Continuously process risk assessments"""
        logger.info("Starting risk assessment processor...")
        
        while self.is_running:
            try:
                # Get payments pending risk assessment
                pending = await self.decision_engine.get_pending_assessments()
                
                for payment in pending:
                    await self._reassess_risk(payment)
                
                await asyncio.sleep(10)
                
            except Exception as e:
                logger.error(f"Error in risk assessment: {e}")
                await asyncio.sleep(5)
    
    async def _reassess_risk(self, payment_data: Dict[str, Any]):
        """Reassess risk for a payment"""
        try:
            # Use AI model for advanced risk analysis
            risk_factors = await self.risk_analyzer.get_risk_factors(payment_data)
            
            # Calculate updated risk score
            new_risk_score = await self.risk_analyzer.calculate_risk_score(
                risk_factors
            )
            
            # Update if score changed significantly
            if abs(new_risk_score - payment_data['current_risk_score']) > 5:
                await self.decision_engine.update_payment_risk_score(
                    payment_data['payment_id'],
                    new_risk_score
                )
                logger.info(f"Updated risk score for {payment_data['payment_id']}: {new_risk_score}")
                
        except Exception as e:
            logger.error(f"Error reassessing risk: {e}")
    
    async def _handle_encryption_requests(self):
        """Handle encryption/decryption requests"""
        logger.info("Starting encryption handler...")
        
        while self.is_running:
            try:
                # Process encryption queue
                requests = await self.encryption_manager.get_pending_requests()
                
                for request in requests:
                    if request['type'] == 'encrypt':
                        await self._encrypt_data(request)
                    elif request['type'] == 'decrypt':
                        await self._decrypt_data(request)
                
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"Error handling encryption: {e}")
                await asyncio.sleep(5)
    
    async def _encrypt_data(self, request: Dict[str, Any]):
        """Encrypt payment data"""
        try:
            encrypted = await self.encryption_manager.encrypt(
                request['data'],
                request['recipient_public_key']
            )
            
            # Store encrypted data
            await self.encryption_manager.store_encrypted_data(
                request['request_id'],
                encrypted
            )
            
            logger.info(f"Encrypted data for request {request['request_id']}")
            
        except Exception as e:
            logger.error(f"Error encrypting data: {e}")
    
    async def _decrypt_data(self, request: Dict[str, Any]):
        """Decrypt payment data"""
        try:
            decrypted = await self.encryption_manager.decrypt(
                request['encrypted_data'],
                request['private_key']
            )
            
            logger.info(f"Decrypted data for request {request['request_id']}")
            return decrypted
            
        except Exception as e:
            logger.error(f"Error decrypting data: {e}")
            return None
    
    async def _execute_autonomous_decisions(self):
        """Execute autonomous decisions based on AI analysis"""
        logger.info("Starting autonomous decision executor...")
        
        while self.is_running:
            try:
                # Get decisions ready for execution
                decisions = await self.decision_engine.get_pending_decisions()
                
                for decision in decisions:
                    await self._execute_decision(decision)
                
                await asyncio.sleep(3)
                
            except Exception as e:
                logger.error(f"Error executing decisions: {e}")
                await asyncio.sleep(5)
    
    async def _execute_decision(self, decision: Dict[str, Any]):
        """Execute a specific decision"""
        try:
            action = decision['action']
            payment_id = decision['payment_id']
            
            if action == 'approve':
                await self.decision_engine.approve_payment(payment_id)
                logger.info(f"Approved payment {payment_id}")
                
            elif action == 'flag':
                await self.decision_engine.flag_payment(
                    payment_id,
                    decision['reason']
                )
                logger.info(f"Flagged payment {payment_id}: {decision['reason']}")
                
            elif action == 'verify_zk_proof':
                await self.decision_engine.verify_zk_proof(
                    payment_id,
                    decision['proof_hash']
                )
                logger.info(f"Verified ZK proof for {payment_id}")
                
            elif action == 'enhance_privacy':
                await self.encryption_manager.enhance_privacy(
                    payment_id,
                    decision['privacy_level']
                )
                logger.info(f"Enhanced privacy for {payment_id}")
            
        except Exception as e:
            logger.error(f"Error executing decision: {e}")


async def main():
    """Main entry point"""
    logger.info("=" * 60)
    logger.info("SolCipher AI Agent - Privacy Layer for Cronos")
    logger.info("=" * 60)
    
    # Create and start agent
    agent = SolCipherAgent()
    
    try:
        await agent.start()
    except KeyboardInterrupt:
        logger.info("\nReceived interrupt signal")
    finally:
        await agent.stop()


if __name__ == "__main__":
    # Ensure logs directory exists
    os.makedirs('logs', exist_ok=True)
    
    # Run the agent
    asyncio.run(main())
