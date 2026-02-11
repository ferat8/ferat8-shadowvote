// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ShadowReputation {
    event ResultClaimed(address indexed user, bytes32 indexed gameId, int16 repDelta, uint8 outcome);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    
    bytes32 public constant CLAIM_TYPEHASH = keccak256("ClaimResult(address user,bytes32 gameId,uint8 outcome,int16 repDelta,uint256 expiry)");
    
    address public owner;
    address public signer;
    string public name = "ShadowReputation";
    string public version = "1";
    
    mapping(address => int256) public reputation;
    mapping(address => uint256) public gamesPlayed;
    mapping(address => uint256) public wins;
    mapping(bytes32 => mapping(address => bool)) public claimed;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _signer) {
        owner = msg.sender;
        signer = _signer;
    }
    
    function claimResult(
        bytes32 gameId,
        uint8 outcome,
        int16 repDelta,
        uint256 expiry,
        bytes calldata signature
    ) external {
        require(block.timestamp <= expiry, "Claim expired");
        require(!claimed[gameId][msg.sender], "Already claimed");
        
        bytes32 domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            block.chainid,
            address(this)
        ));
        
        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH,
            msg.sender,
            gameId,
            outcome,
            repDelta,
            expiry
        ));
        
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        
        require(signature.length == 65, "Invalid sig length");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        
        address recovered = ecrecover(digest, v, r, s);
        require(recovered == signer, "Invalid signature");
        
        claimed[gameId][msg.sender] = true;
        reputation[msg.sender] += repDelta;
        gamesPlayed[msg.sender]++;
        if (outcome == 1) wins[msg.sender]++;
        
        emit ResultClaimed(msg.sender, gameId, repDelta, outcome);
    }
    
    function getStats(address player) external view returns (int256, uint256, uint256) {
        return (reputation[player], gamesPlayed[player], wins[player]);
    }
    
    function hasClaimed(bytes32 gameId, address player) external view returns (bool) {
        return claimed[gameId][player];
    }
    
    function setSigner(address _signer) external onlyOwner {
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }
    
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            block.chainid,
            address(this)
        ));
    }
}