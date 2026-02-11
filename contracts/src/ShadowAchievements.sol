// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ShadowAchievements
 * @notice Soulbound achievement NFTs for ShadowVote
 * @dev Non-transferable ERC1155-like tokens for achievements
 */
contract ShadowAchievements {
    // Events
    event AchievementMinted(address indexed player, uint256 indexed achievementId, uint256 timestamp);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);

    // Achievement IDs
    uint256 public constant FIRST_BLOOD = 1;
    uint256 public constant SHERLOCK = 2;
    uint256 public constant SURVIVOR = 3;
    uint256 public constant SAVIOR = 4;
    uint256 public constant TRICKSTER = 5;
    uint256 public constant LEADER = 6;
    uint256 public constant PERFECT_GAME = 7;
    uint256 public constant TOURNAMENT_WINNER = 8;

    // EIP-712 domain
    bytes32 public constant MINT_TYPEHASH = keccak256(
        "MintAchievement(address player,uint256 achievementId,uint256 expiry)"
    );

    string public name = "ShadowVote Achievements";
    string public symbol = "SVACH";
    address public owner;
    address public signer;

    // player => achievementId => owned
    mapping(address => mapping(uint256 => bool)) public achievements;
    // player => total achievement count
    mapping(address => uint256) public achievementCount;
    // achievementId => total minted
    mapping(uint256 => uint256) public totalMinted;
    // achievementId => metadata URI
    mapping(uint256 => string) public tokenURI;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _signer) {
        owner = msg.sender;
        signer = _signer;
        
        // Set default URIs
        tokenURI[FIRST_BLOOD] = "https://shadowvote-beta.vercel.app/api/achievements/1";
        tokenURI[SHERLOCK] = "https://shadowvote-beta.vercel.app/api/achievements/2";
        tokenURI[SURVIVOR] = "https://shadowvote-beta.vercel.app/api/achievements/3";
        tokenURI[SAVIOR] = "https://shadowvote-beta.vercel.app/api/achievements/4";
        tokenURI[TRICKSTER] = "https://shadowvote-beta.vercel.app/api/achievements/5";
        tokenURI[LEADER] = "https://shadowvote-beta.vercel.app/api/achievements/6";
        tokenURI[PERFECT_GAME] = "https://shadowvote-beta.vercel.app/api/achievements/7";
        tokenURI[TOURNAMENT_WINNER] = "https://shadowvote-beta.vercel.app/api/achievements/8";
    }

    /**
     * @notice Claim an achievement with server signature
     */
    function claimAchievement(
        uint256 achievementId,
        uint256 expiry,
        bytes calldata signature
    ) external {
        require(block.timestamp <= expiry, "Expired");
        require(!achievements[msg.sender][achievementId], "Already claimed");
        require(achievementId >= 1 && achievementId <= 8, "Invalid achievement");

        // Verify signature
        bytes32 domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));

        bytes32 structHash = keccak256(abi.encode(
            MINT_TYPEHASH,
            msg.sender,
            achievementId,
            expiry
        ));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        require(signature.length == 65, "Invalid sig");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        require(ecrecover(digest, v, r, s) == signer, "Invalid signature");

        // Mint achievement
        achievements[msg.sender][achievementId] = true;
        achievementCount[msg.sender]++;
        totalMinted[achievementId]++;

        emit AchievementMinted(msg.sender, achievementId, block.timestamp);
    }

    /**
     * @notice Check if player has an achievement
     */
    function hasAchievement(address player, uint256 achievementId) external view returns (bool) {
        return achievements[player][achievementId];
    }

    /**
     * @notice Get all achievements for a player (bitmap)
     */
    function getAchievements(address player) external view returns (uint256) {
        uint256 bitmap = 0;
        for (uint256 i = 1; i <= 8; i++) {
            if (achievements[player][i]) {
                bitmap |= (1 << i);
            }
        }
        return bitmap;
    }

    // Admin functions
    function setSigner(address _signer) external onlyOwner {
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    function setTokenURI(uint256 achievementId, string calldata uri) external onlyOwner {
        tokenURI[achievementId] = uri;
    }

    // Soulbound: transfers are disabled
    function transferFrom(address, address, uint256) external pure {
        revert("Soulbound: transfers disabled");
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert("Soulbound: transfers disabled");
    }
}
