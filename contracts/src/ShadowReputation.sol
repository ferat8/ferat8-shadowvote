// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title ShadowReputation
 * @notice Soulbound reputation system for ShadowVote game
 * @dev Non-transferable reputation tracking based on game results
 */
contract ShadowReputation is Ownable, EIP712 {
    using ECDSA for bytes32;

    // Events
    event ResultClaimed(
        address indexed user,
        bytes32 indexed gameId,
        int16 repDelta,
        uint8 outcome // 0=loss, 1=win, 2=draw
    );
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);

    // EIP-712 typehash
    bytes32 public constant CLAIM_TYPEHASH = keccak256(
        "ClaimResult(address user,bytes32 gameId,uint8 outcome,int16 repDelta,uint256 expiry)"
    );

    // State
    address public signer;
    mapping(address => int256) public reputation;
    mapping(address => uint256) public gamesPlayed;
    mapping(address => uint256) public wins;
    mapping(bytes32 => mapping(address => bool)) public claimed;

    constructor(address _signer) 
        Ownable(msg.sender)
        EIP712("ShadowReputation", "1")
    {
        signer = _signer;
    }

    /**
     * @notice Claim reputation update from a completed game
     * @param gameId Unique game identifier
     * @param outcome Game outcome: 0=loss, 1=win, 2=draw
     * @param repDelta Reputation change (can be negative)
     * @param expiry Claim expiry timestamp
     * @param signature Server signature authorizing claim
     */
    function claimResult(
        bytes32 gameId,
        uint8 outcome,
        int16 repDelta,
        uint256 expiry,
        bytes calldata signature
    ) external {
        require(block.timestamp <= expiry, "Claim expired");
        require(!claimed[gameId][msg.sender], "Already claimed");

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH,
            msg.sender,
            gameId,
            outcome,
            repDelta,
            expiry
        ));
        
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(digest, signature);
        require(recoveredSigner == signer, "Invalid signature");

        // Mark as claimed
        claimed[gameId][msg.sender] = true;

        // Update stats
        reputation[msg.sender] += repDelta;
        gamesPlayed[msg.sender]++;
        if (outcome == 1) {
            wins[msg.sender]++;
        }

        emit ResultClaimed(msg.sender, gameId, repDelta, outcome);
    }

    /**
     * @notice Get player stats
     * @param player Player address
     * @return rep Current reputation
     * @return games Total games played
     * @return winCount Total wins
     */
    function getStats(address player) external view returns (
        int256 rep,
        uint256 games,
        uint256 winCount
    ) {
        return (reputation[player], gamesPlayed[player], wins[player]);
    }

    /**
     * @notice Check if a claim has been made
     * @param gameId Game identifier
     * @param player Player address
     */
    function hasClaimed(bytes32 gameId, address player) external view returns (bool) {
        return claimed[gameId][player];
    }

    // Admin functions
    function setSigner(address _signer) external onlyOwner {
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
