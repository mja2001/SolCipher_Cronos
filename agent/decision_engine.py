"""
Decision Engine Module
Autonomous decision-making for payment processing
"""

import logging
from typing import Dict, Any, List, Optional
from web3 import Web3
from eth_account import Account
import json

logger = logging.getLogger(__name__)


class DecisionEngine:
    """Autonomous decision engine for transaction processing"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize decision engine"""
        self.config = config
        self.risk_threshold = config.get('risk_threshold', 0.75)
        
        # Initialize Web3 connection
        self.w3 = Web3(Web3.HTTPProvider(config['cronos_rpc_url']))
        self.account = Account.from_key(config['private_key'])
        
        # Load contract ABI (simplified)
        self.contract_address = config.get('contract_address')
        self.contract = None
        
        if self.contract_address:
            self._load_contract()
        
        # Decision cache
        self.pending_decisions: List[Dict[str, Any]] = []
        
        logger.info("Decision Engine initialized")
    
    def _load_contract(self):
        """Load smart contract instance"""
        try:
            # Simplified ABI - in production, load from JSON file
            contract_abi = [
                {
                    "inputs": [
                        {"name": "paymentId", "type": "bytes32"},
                        {"name": "riskScore", "type": "uint256"}
                    ],
                    "name": "updateRiskScore",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {"name": "paymentId", "type": "bytes32"},
                        {"name": "proofHash", "type": "bytes32"}
                    ],
                    "name": "verifyZKProof",
                    "outputs": [{"name": "", "type": "bool"}],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "paymentId", "type": "bytes32"}],
                    "name": "completePayment",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ]
            
            self.contract = self.w3.eth.contract(
                address=self.contract_address,
                abi=contract_abi
            )
            
            logger.info(f"Contract loaded at {self.contract_address}")
            
        except Exception as e:
            logger.error(f"Error loading contract: {e}")
    
    async def make_decision(
        self,
        payment_id: str,
        risk_score: float,
        payment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Make autonomous decision about payment processing
        
        Returns:
            Decision dictionary with action and reasoning
        """
        try:
            logger.info(f"Making decision for payment {payment_id}")
            
            decision = {
                'payment_id': payment_id,
                'risk_score': risk_score,
                'timestamp': payment_data.get('timestamp'),
                'action': None,
                'reason': None
            }
            
            # Decision logic based on risk score
            if risk_score < 20:
                # Very low risk - auto approve
                decision['action'] = 'approve'
                decision['reason'] = 'Very low risk transaction'
                
            elif risk_score < 40:
                # Low risk - approve with standard privacy
                decision['action'] = 'approve'
                decision['reason'] = 'Low risk transaction'
                
            elif risk_score < 60:
                # Medium risk - verify ZK proof
                decision['action'] = 'verify_zk_proof'
                decision['reason'] = 'Medium risk - additional verification required'
                
            elif risk_score < 80:
                # High risk - enhance privacy and verify
                decision['action'] = 'enhance_privacy'
                decision['reason'] = 'High risk - enhanced privacy measures applied'
                decision['privacy_level'] = 'high'
                
            else:
                # Very high risk - flag for review
                decision['action'] = 'flag'
                decision['reason'] = 'Very high risk - flagged for manual review'
            
            # Check for specific risk patterns
            if self._check_critical_patterns(payment_data):
                decision['action'] = 'flag'
                decision['reason'] = 'Critical risk pattern detected'
            
            # Add to pending decisions queue
            self.pending_decisions.append(decision)
            
            logger.info(f"Decision for {payment_id}: {decision['action']}")
            return decision
            
        except Exception as e:
            logger.error(f"Error making decision: {e}")
            return {
                'payment_id': payment_id,
                'action': 'flag',
                'reason': f'Error in decision making: {str(e)}'
            }
    
    def _check_critical_patterns(self, payment_data: Dict[str, Any]) -> bool:
        """Check for critical risk patterns that require immediate flagging"""
        
        # Pattern 1: Extremely large amounts
        if payment_data.get('amount', 0) > 100000:
            return True
        
        # Pattern 2: Suspicious metadata keywords
        metadata = payment_data.get('metadata', {})
        suspicious_keywords = ['exploit', 'hack', 'drain', 'rug']
        metadata_str = str(metadata).lower()
        
        for keyword in suspicious_keywords:
            if keyword in metadata_str:
                return True
        
        return False
    
    async def get_pending_payments(self) -> List[Dict[str, Any]]:
        """Get pending payments from blockchain"""
        
        # In production, this would query blockchain events
        # Mock implementation for now
        pending = []
        
        try:
            if not self.contract:
                logger.warning("Contract not loaded, returning empty list")
                return []
            
            # Query PaymentEncrypted events from last 100 blocks
            # This is a simplified version
            logger.info("Querying pending payments from blockchain")
            
            # Mock data for demonstration
            # In production, use: self.contract.events.PaymentEncrypted.get_logs()
            
        except Exception as e:
            logger.error(f"Error getting pending payments: {e}")
        
        return pending
    
    async def get_pending_assessments(self) -> List[Dict[str, Any]]:
        """Get payments pending risk assessment"""
        
        # Mock implementation
        assessments = []
        
        try:
            logger.info("Getting pending risk assessments")
            # In production, query payments with status == Pending
            
        except Exception as e:
            logger.error(f"Error getting pending assessments: {e}")
        
        return assessments
    
    async def get_pending_decisions(self) -> List[Dict[str, Any]]:
        """Get pending decisions ready for execution"""
        decisions = self.pending_decisions.copy()
        self.pending_decisions.clear()
        return decisions
    
    async def update_payment_risk_score(
        self,
        payment_id: str,
        risk_score: float
    ) -> bool:
        """Update risk score on blockchain"""
        
        try:
            if not self.contract:
                logger.error("Contract not loaded")
                return False
            
            logger.info(f"Updating risk score for {payment_id}: {risk_score}")
            
            # Convert payment_id to bytes32
            payment_id_bytes = Web3.to_bytes(hexstr=payment_id)
            risk_score_int = int(risk_score)
            
            # Build transaction
            tx = self.contract.functions.updateRiskScore(
                payment_id_bytes,
                risk_score_int
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Sign and send transaction
            signed_tx = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Wait for receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if receipt.status == 1:
                logger.info(f"Risk score updated successfully: {tx_hash.hex()}")
                return True
            else:
                logger.error(f"Transaction failed: {tx_hash.hex()}")
                return False
                
        except Exception as e:
            logger.error(f"Error updating risk score: {e}")
            return False
    
    async def approve_payment(self, payment_id: str) -> bool:
        """Approve a payment for completion"""
        
        try:
            logger.info(f"Approving payment {payment_id}")
            
            # In production, call completePayment on contract
            # For now, just log
            logger.info(f"Payment {payment_id} approved")
            return True
            
        except Exception as e:
            logger.error(f"Error approving payment: {e}")
            return False
    
    async def flag_payment(self, payment_id: str, reason: str) -> bool:
        """Flag a payment for manual review"""
        
        try:
            logger.warning(f"Flagging payment {payment_id}: {reason}")
            
            # In production, emit event or store in database
            # Could also pause the payment or trigger alerts
            
            return True
            
        except Exception as e:
            logger.error(f"Error flagging payment: {e}")
            return False
    
    async def verify_zk_proof(
        self,
        payment_id: str,
        proof_hash: str
    ) -> bool:
        """Verify zero-knowledge proof for payment"""
        
        try:
            if not self.contract:
                logger.error("Contract not loaded")
                return False
            
            logger.info(f"Verifying ZK proof for {payment_id}")
            
            payment_id_bytes = Web3.to_bytes(hexstr=payment_id)
            proof_hash_bytes = Web3.to_bytes(hexstr=proof_hash)
            
            # Call contract function
            tx = self.contract.functions.verifyZKProof(
                payment_id_bytes,
                proof_hash_bytes
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            signed_tx = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if receipt.status == 1:
                logger.info(f"ZK proof verified: {tx_hash.hex()}")
                return True
            else:
                logger.error(f"ZK proof verification failed")
                return False
                
        except Exception as e:
            logger.error(f"Error verifying ZK proof: {e}")
            return False
    
    def get_contract_address(self) -> Optional[str]:
        """Get current contract address"""
        return self.contract_address
    
    def is_connected(self) -> bool:
        """Check if connected to blockchain"""
        try:
            return self.w3.is_connected()
        except:
            return False
