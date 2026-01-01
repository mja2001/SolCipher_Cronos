import { expect } from "chai";
import { ethers } from "hardhat";
import { SolCipherCore } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SolCipherCore", function () {
  let solCipherCore: SolCipherCore;
  let owner: SignerWithAddress;
  let agent: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, agent, user1, user2] = await ethers.getSigners();

    const SolCipherCore = await ethers.getContractFactory("SolCipherCore");
    solCipherCore = await SolCipherCore.deploy();
    await solCipherCore.waitForDeployment();

    // Authorize agent
    await solCipherCore.setAgentAuthorization(agent.address, true);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await solCipherCore.owner()).to.equal(owner.address);
    });

    it("Should start with payment counter at 0", async function () {
      expect(await solCipherCore.paymentCounter()).to.equal(0);
    });

    it("Should have correct default risk threshold", async function () {
      expect(await solCipherCore.defaultRiskThreshold()).to.equal(75);
    });
  });

  describe("Agent Authorization", function () {
    it("Should authorize agent correctly", async function () {
      expect(await solCipherCore.authorizedAgents(agent.address)).to.be.true;
    });

    it("Should allow owner to authorize new agents", async function () {
      await solCipherCore.setAgentAuthorization(user1.address, true);
      expect(await solCipherCore.authorizedAgents(user1.address)).to.be.true;
    });

    it("Should allow owner to revoke agent authorization", async function () {
      await solCipherCore.setAgentAuthorization(agent.address, false);
      expect(await solCipherCore.authorizedAgents(agent.address)).to.be.false;
    });

    it("Should reject authorization from non-owner", async function () {
      await expect(
        solCipherCore.connect(user1).setAgentAuthorization(user2.address, true)
      ).to.be.revertedWithCustomError(solCipherCore, "OwnableUnauthorizedAccount");
    });
  });

  describe("Encrypted Payments", function () {
    const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("recipient123"));
    const encryptedAmount = ethers.toUtf8Bytes("encrypted_amount_data");
    const encryptedMetadata = ethers.toUtf8Bytes("encrypted_metadata_data");

    it("Should create encrypted payment", async function () {
      const tx = await solCipherCore
        .connect(user1)
        .createEncryptedPayment(recipientHash, encryptedAmount, encryptedMetadata);

      await expect(tx).to.emit(solCipherCore, "PaymentEncrypted");

      expect(await solCipherCore.paymentCounter()).to.equal(1);
    });

    it("Should reject payment with zero recipient hash", async function () {
      await expect(
        solCipherCore
          .connect(user1)
          .createEncryptedPayment(ethers.ZeroHash, encryptedAmount, encryptedMetadata)
      ).to.be.revertedWith("Invalid recipient hash");
    });

    it("Should reject payment with empty encrypted amount", async function () {
      await expect(
        solCipherCore
          .connect(user1)
          .createEncryptedPayment(recipientHash, "0x", encryptedMetadata)
      ).to.be.revertedWith("Invalid encrypted amount");
    });

    it("Should store payment data correctly", async function () {
      const tx = await solCipherCore
        .connect(user1)
        .createEncryptedPayment(recipientHash, encryptedAmount, encryptedMetadata);

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "PaymentEncrypted"
      );

      // Get payment ID from event
      const paymentId = event?.args?.paymentId;

      const payment = await solCipherCore.getPayment(paymentId);
      expect(payment.sender).to.equal(user1.address);
      expect(payment.recipientHash).to.equal(recipientHash);
      expect(payment.status).to.equal(0); // Pending
    });
  });

  describe("Risk Score Updates", function () {
    let paymentId: string;
    const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("recipient123"));
    const encryptedAmount = ethers.toUtf8Bytes("encrypted_amount_data");
    const encryptedMetadata = ethers.toUtf8Bytes("encrypted_metadata_data");

    beforeEach(async function () {
      const tx = await solCipherCore
        .connect(user1)
        .createEncryptedPayment(recipientHash, encryptedAmount, encryptedMetadata);

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "PaymentEncrypted"
      );
      paymentId = event?.args?.paymentId;
    });

    it("Should allow authorized agent to update risk score", async function () {
      const riskScore = 50;

      await expect(solCipherCore.connect(agent).updateRiskScore(paymentId, riskScore))
        .to.emit(solCipherCore, "RiskAssessmentUpdated")
        .withArgs(paymentId, 0, riskScore);

      const payment = await solCipherCore.getPayment(paymentId);
      expect(payment.riskScore).to.equal(riskScore);
      expect(payment.status).to.equal(1); // Verified
    });

    it("Should flag payment with high risk score", async function () {
      const highRiskScore = 80;

      await solCipherCore.connect(agent).updateRiskScore(paymentId, highRiskScore);

      const payment = await solCipherCore.getPayment(paymentId);
      expect(payment.status).to.equal(4); // Flagged
    });

    it("Should reject risk score update from unauthorized address", async function () {
      await expect(
        solCipherCore.connect(user2).updateRiskScore(paymentId, 50)
      ).to.be.revertedWith("Not authorized agent");
    });

    it("Should reject invalid risk score", async function () {
      await expect(
        solCipherCore.connect(agent).updateRiskScore(paymentId, 101)
      ).to.be.revertedWith("Invalid risk score");
    });
  });

  describe("Privacy Settings", function () {
    it("Should allow user to set privacy settings", async function () {
      await solCipherCore
        .connect(user1)
        .setPrivacySettings(true, true, 80, true);

      const settings = await solCipherCore.getPrivacySettings(user1.address);
      expect(settings.zkProofsEnabled).to.be.true;
      expect(settings.aiRiskCheckEnabled).to.be.true;
      expect(settings.minRiskThreshold).to.equal(80);
      expect(settings.metadataEncryptionRequired).to.be.true;
    });

    it("Should reject invalid risk threshold", async function () {
      await expect(
        solCipherCore.connect(user1).setPrivacySettings(true, true, 101, true)
      ).to.be.revertedWith("Invalid threshold");
    });

    it("Should emit event when settings updated", async function () {
      await expect(
        solCipherCore.connect(user1).setPrivacySettings(true, true, 80, true)
      )
        .to.emit(solCipherCore, "PrivacySettingsUpdated")
        .withArgs(user1.address, true, true);
    });
  });

  describe("ZK Proof Verification", function () {
    let paymentId: string;
    const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("recipient123"));
    const encryptedAmount = ethers.toUtf8Bytes("encrypted_amount_data");
    const encryptedMetadata = ethers.toUtf8Bytes("encrypted_metadata_data");

    beforeEach(async function () {
      const tx = await solCipherCore
        .connect(user1)
        .createEncryptedPayment(recipientHash, encryptedAmount, encryptedMetadata);

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "PaymentEncrypted"
      );
      paymentId = event?.args?.paymentId;

      // Update risk score to verified
      await solCipherCore.connect(agent).updateRiskScore(paymentId, 50);
    });

    it("Should allow agent to verify ZK proof", async function () {
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof_data"));

      await solCipherCore.connect(agent).verifyZKProof(paymentId, proofHash);

      expect(await solCipherCore.verifiedProofs(proofHash)).to.be.true;

      const payment = await solCipherCore.getPayment(paymentId);
      expect(payment.status).to.equal(2); // Completed
    });

    it("Should reject invalid proof hash", async function () {
      await expect(
        solCipherCore.connect(agent).verifyZKProof(paymentId, ethers.ZeroHash)
      ).to.be.revertedWith("Invalid proof hash");
    });
  });

  describe("Payment Completion", function () {
    let paymentId: string;
    const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("recipient123"));
    const encryptedAmount = ethers.toUtf8Bytes("encrypted_amount_data");
    const encryptedMetadata = ethers.toUtf8Bytes("encrypted_metadata_data");

    beforeEach(async function () {
      const tx = await solCipherCore
        .connect(user1)
        .createEncryptedPayment(recipientHash, encryptedAmount, encryptedMetadata);

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "PaymentEncrypted"
      );
      paymentId = event?.args?.paymentId;

      await solCipherCore.connect(agent).updateRiskScore(paymentId, 50);
    });

    it("Should allow sender to complete verified payment", async function () {
      await expect(solCipherCore.connect(user1).completePayment(paymentId))
        .to.emit(solCipherCore, "PaymentCompleted")
        .withArgs(paymentId, user1.address, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1));

      const payment = await solCipherCore.getPayment(paymentId);
      expect(payment.status).to.equal(2); // Completed
    });

    it("Should reject completion from non-sender", async function () {
      await expect(
        solCipherCore.connect(user2).completePayment(paymentId)
      ).to.be.revertedWith("Not payment sender");
    });

    it("Should reject completion of unverified payment", async function () {
      // Create new payment
      const tx = await solCipherCore
        .connect(user1)
        .createEncryptedPayment(recipientHash, encryptedAmount, encryptedMetadata);

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment && log.fragment.name === "PaymentEncrypted"
      );
      const newPaymentId = event?.args?.paymentId;

      await expect(
        solCipherCore.connect(user1).completePayment(newPaymentId)
      ).to.be.revertedWith("Payment not verified");
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow owner to pause contract", async function () {
      await solCipherCore.pause();
      expect(await solCipherCore.paused()).to.be.true;
    });

    it("Should prevent operations when paused", async function () {
      await solCipherCore.pause();

      const recipientHash = ethers.keccak256(ethers.toUtf8Bytes("recipient123"));
      const encryptedAmount = ethers.toUtf8Bytes("encrypted_amount_data");
      const encryptedMetadata = ethers.toUtf8Bytes("encrypted_metadata_data");

      await expect(
        solCipherCore
          .connect(user1)
          .createEncryptedPayment(recipientHash, encryptedAmount, encryptedMetadata)
      ).to.be.revertedWithCustomError(solCipherCore, "EnforcedPause");
    });

    it("Should allow owner to unpause", async function () {
      await solCipherCore.pause();
      await solCipherCore.unpause();
      expect(await solCipherCore.paused()).to.be.false;
    });
  });
});
