// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

/// @title Ethernal — non-custodial on-chain inheritance vault
/// @notice Owner deposits assets, keeps a heartbeat alive (any owner action counts).
///         If the heartbeat lapses, heirs can initiate a claim; a challenge window
///         (and an optional guardian veto) lets the owner cancel it. Once finalized,
///         each heir pulls their share — ETH, ERC-20s, and specifically-bequeathed NFTs.
///         Heirs may be public addresses or salted commitments for privacy.
contract Ethernal {
    uint16 public constant BPS = 10_000;
    uint64 public constant MIN_HEARTBEAT = 60; // 60s minimum so demos can run live
    uint8  public constant MAX_TOKENS = 20;
    uint8  public constant MAX_HEIRS = 32;
    uint8  public constant MAX_NFTS_PER_HEIR = 32;

    enum Status { Active, Lapsed, Challenged, Claimable, Drained }

    struct NftRef {
        address token;
        uint256 tokenId;
    }

    struct Vault {
        address owner;
        address guardian;       // optional: may veto a claim, can never touch funds
        bool privateHeirs;      // if true, heirKeys are keccak256(heir, salt)
        uint64 heartbeatInterval;
        uint64 challengePeriod;
        uint64 lastCheckIn;
        uint64 claimStart;      // 0 = no claim in progress
        bool finalized;         // heirs may withdraw
        uint256 ethBalance;
        address[] tokens;       // distinct ERC-20s deposited
    }

    uint256 public nextVaultId;
    mapping(uint256 => Vault) private vaults;
    mapping(uint256 => bytes32[]) private heirKeys;                          // commitment or addr-as-key
    mapping(uint256 => address[]) private publicHeirs;                       // only when !privateHeirs
    mapping(uint256 => mapping(bytes32 => uint16)) public shareOf;           // vault => key => bps
    mapping(uint256 => mapping(bytes32 => bool)) public hasWithdrawn;        // vault => key => done
    mapping(uint256 => mapping(bytes32 => bytes)) public letterOf;           // vault => key => ciphertext
    mapping(uint256 => mapping(bytes32 => NftRef[])) private heirNfts;       // vault => key => bequests
    mapping(uint256 => mapping(address => uint256)) public tokenBalance;     // vault => token => amount
    mapping(uint256 => uint256) public ethPaidOut;
    mapping(uint256 => mapping(address => uint256)) public tokenPaidOut;
    mapping(address => uint256[]) private vaultsByOwner;
    mapping(address => uint256[]) private vaultsByHeir;                      // public-heir vaults only
    mapping(address => uint256[]) private vaultsByGuardian;
    mapping(uint256 => mapping(address => bool)) private tokenSeen;

    event VaultCreated(uint256 indexed id, address indexed owner, uint64 heartbeat, uint64 challenge, bool privateHeirs);
    event Deposited(uint256 indexed id, address indexed token, uint256 amount); // token=0x0 for ETH
    event OwnerWithdraw(uint256 indexed id, address indexed token, uint256 amount);
    event Pinged(uint256 indexed id, uint64 at);
    event HeirsUpdated(uint256 indexed id);
    event GuardianSet(uint256 indexed id, address indexed guardian);
    event LetterSet(uint256 indexed id, bytes32 indexed heirKey);
    event Bequeathed(uint256 indexed id, bytes32 indexed heirKey, address token, uint256 tokenId);
    event Reclaimed721(uint256 indexed id, address token, uint256 tokenId);
    event ClaimInitiated(uint256 indexed id, bytes32 indexed heirKey, uint64 at);
    event ClaimCancelled(uint256 indexed id);
    event ClaimVetoed(uint256 indexed id, address indexed guardian);
    event ClaimFinalized(uint256 indexed id);
    event ShareWithdrawn(uint256 indexed id, address indexed heir, uint256 ethAmount, uint256 nftCount);

    error NotOwner();
    error NotHeir();
    error VaultFinalized();
    error HeartbeatNotLapsed();
    error ClaimActive();
    error NoClaimActive();
    error ChallengeNotOver();
    error AlreadyWithdrawn();
    error BadShares();
    error TooManyTokens();
    error TooManyHeirs();
    error TooManyNfts();
    error TransferFailed();
    error IntervalTooShort();
    error ZeroAmount();
    error EmptyHeirs();
    error NotGuardian();
    error BadNftIndex();

    modifier onlyOwner(uint256 id) {
        if (msg.sender != vaults[id].owner) revert NotOwner();
        _;
    }
    modifier notFinalized(uint256 id) {
        if (vaults[id].finalized) revert VaultFinalized();
        _;
    }

    /// @dev Every owner action is a heartbeat: refreshes liveness and cancels
    ///      any pending claim (an owner sending a transaction is alive).
    function _touch(uint256 id) internal {
        Vault storage v = vaults[id];
        if (v.claimStart != 0) {
            v.claimStart = 0;
            emit ClaimCancelled(id);
        }
        v.lastCheckIn = uint64(block.timestamp);
        emit Pinged(id, v.lastCheckIn);
    }

    function keyOf(uint256 id, address heir, bytes32 salt) public view returns (bytes32) {
        return vaults[id].privateHeirs
            ? keccak256(abi.encodePacked(heir, salt))
            : bytes32(uint256(uint160(heir)));
    }

    function createVault(
        address[] calldata heirs,
        bytes32[] calldata salts,
        uint16[] calldata sharesBps,
        uint64 heartbeatInterval,
        uint64 challengePeriod,
        address guardian,
        bool privateHeirs
    ) external returns (uint256 id) {
        if (heartbeatInterval < MIN_HEARTBEAT) revert IntervalTooShort();
        if (heirs.length == 0) revert EmptyHeirs();
        if (heirs.length > MAX_HEIRS) revert TooManyHeirs();

        Vault storage v = vaults[id = nextVaultId++];
        v.owner = msg.sender;
        v.guardian = guardian;
        v.privateHeirs = privateHeirs;
        v.heartbeatInterval = heartbeatInterval;
        v.challengePeriod = challengePeriod;
        v.lastCheckIn = uint64(block.timestamp);

        _setHeirs(id, heirs, salts, sharesBps);
        vaultsByOwner[msg.sender].push(id);
        if (guardian != address(0)) vaultsByGuardian[guardian].push(id);

        emit VaultCreated(id, msg.sender, heartbeatInterval, challengePeriod, privateHeirs);
        emit Pinged(id, v.lastCheckIn);
    }

    // ---------- owner ----------

    function ping(uint256 id) external onlyOwner(id) notFinalized(id) {
        _touch(id);
    }

    function depositETH(uint256 id) external payable onlyOwner(id) notFinalized(id) {
        if (msg.value == 0) revert ZeroAmount();
        vaults[id].ethBalance += msg.value;
        _touch(id);
        emit Deposited(id, address(0), msg.value);
    }

    function depositToken(uint256 id, address token, uint256 amount) external onlyOwner(id) notFinalized(id) {
        if (amount == 0) revert ZeroAmount();
        Vault storage v = vaults[id];
        if (!tokenSeen[id][token]) {
            if (v.tokens.length >= MAX_TOKENS) revert TooManyTokens();
            tokenSeen[id][token] = true;
            v.tokens.push(token);
        }
        if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        tokenBalance[id][token] += amount;
        _touch(id);
        emit Deposited(id, token, amount);
    }

    function ownerWithdrawETH(uint256 id, uint256 amount) external onlyOwner(id) notFinalized(id) {
        Vault storage v = vaults[id];
        v.ethBalance -= amount;
        _touch(id);
        emit OwnerWithdraw(id, address(0), amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function ownerWithdrawToken(uint256 id, address token, uint256 amount) external onlyOwner(id) notFinalized(id) {
        tokenBalance[id][token] -= amount;
        _touch(id);
        emit OwnerWithdraw(id, token, amount);
        if (!IERC20(token).transfer(msg.sender, amount)) revert TransferFailed();
    }

    /// @notice Deposit an NFT and bequeath it to a specific heir (specific bequest).
    function bequeath721(uint256 id, address token, uint256 tokenId, address heir, bytes32 salt)
        external onlyOwner(id) notFinalized(id)
    {
        bytes32 key = keyOf(id, heir, salt);
        if (shareOf[id][key] == 0) revert NotHeir();
        NftRef[] storage list = heirNfts[id][key];
        if (list.length >= MAX_NFTS_PER_HEIR) revert TooManyNfts();
        IERC721(token).safeTransferFrom(msg.sender, address(this), tokenId);
        list.push(NftRef(token, tokenId));
        _touch(id);
        emit Bequeathed(id, key, token, tokenId);
    }

    /// @notice Owner reclaims a bequeathed NFT before finalization.
    function reclaim721(uint256 id, address heir, bytes32 salt, uint256 nftIndex)
        external onlyOwner(id) notFinalized(id)
    {
        NftRef[] storage list = heirNfts[id][keyOf(id, heir, salt)];
        if (nftIndex >= list.length) revert BadNftIndex();
        NftRef memory n = list[nftIndex];
        list[nftIndex] = list[list.length - 1];
        list.pop();
        _touch(id);
        IERC721(n.token).safeTransferFrom(address(this), msg.sender, n.tokenId);
        emit Reclaimed721(id, n.token, n.tokenId);
    }

    function setHeirs(uint256 id, address[] calldata heirs, bytes32[] calldata salts, uint16[] calldata sharesBps)
        external onlyOwner(id) notFinalized(id)
    {
        if (heirs.length == 0) revert EmptyHeirs();
        if (heirs.length > MAX_HEIRS) revert TooManyHeirs();
        // clear old shares & public heir index
        bytes32[] storage old = heirKeys[id];
        for (uint256 i; i < old.length; i++) shareOf[id][old[i]] = 0;
        address[] storage pub = publicHeirs[id];
        for (uint256 i; i < pub.length; i++) _removeHeirIndex(pub[i], id);
        delete heirKeys[id];
        delete publicHeirs[id];
        _setHeirs(id, heirs, salts, sharesBps);
        _touch(id);
        emit HeirsUpdated(id);
    }

    function setHeartbeatInterval(uint256 id, uint64 interval) external onlyOwner(id) notFinalized(id) {
        if (interval < MIN_HEARTBEAT) revert IntervalTooShort();
        vaults[id].heartbeatInterval = interval;
        _touch(id);
    }

    function setChallengePeriod(uint256 id, uint64 period) external onlyOwner(id) notFinalized(id) {
        vaults[id].challengePeriod = period;
        _touch(id);
    }

    function setGuardian(uint256 id, address guardian) external onlyOwner(id) notFinalized(id) {
        address old = vaults[id].guardian;
        if (old != address(0)) _removeGuardianIndex(old, id);
        vaults[id].guardian = guardian;
        if (guardian != address(0)) vaultsByGuardian[guardian].push(id);
        _touch(id);
        emit GuardianSet(id, guardian);
    }

    /// @notice Store an encrypted letter for an heir (AES-GCM ciphertext, passphrase given off-chain).
    function setLetter(uint256 id, address heir, bytes32 salt, bytes calldata ciphertext)
        external onlyOwner(id) notFinalized(id)
    {
        bytes32 key = keyOf(id, heir, salt);
        if (shareOf[id][key] == 0) revert NotHeir();
        letterOf[id][key] = ciphertext;
        _touch(id);
        emit LetterSet(id, key);
    }

    // ---------- guardian ----------

    /// @notice Guardian may veto an active claim — can never touch funds.
    function vetoClaim(uint256 id) external notFinalized(id) {
        Vault storage v = vaults[id];
        if (msg.sender != v.guardian || v.guardian == address(0)) revert NotGuardian();
        if (v.claimStart == 0) revert NoClaimActive();
        v.claimStart = 0;
        emit ClaimVetoed(id, msg.sender);
    }

    // ---------- heirs ----------

    function initiateClaim(uint256 id, bytes32 salt) external notFinalized(id) {
        bytes32 key = keyOf(id, msg.sender, salt);
        if (shareOf[id][key] == 0) revert NotHeir();
        Vault storage v = vaults[id];
        if (block.timestamp <= v.lastCheckIn + v.heartbeatInterval) revert HeartbeatNotLapsed();
        if (v.claimStart != 0) revert ClaimActive();
        v.claimStart = uint64(block.timestamp);
        emit ClaimInitiated(id, key, v.claimStart);
    }

    function finalizeClaim(uint256 id) external notFinalized(id) {
        Vault storage v = vaults[id];
        if (v.claimStart == 0) revert NoClaimActive();
        if (block.timestamp < v.claimStart + v.challengePeriod) revert ChallengeNotOver();
        v.finalized = true;
        emit ClaimFinalized(id);
    }

    /// @notice Heir pulls their share of ETH, every deposited token, and bequeathed NFTs. Once.
    function withdrawShare(uint256 id, bytes32 salt) external {
        Vault storage v = vaults[id];
        if (!v.finalized) revert ChallengeNotOver();
        bytes32 key = keyOf(id, msg.sender, salt);
        uint16 bps = shareOf[id][key];
        if (bps == 0) revert NotHeir();
        if (hasWithdrawn[id][key]) revert AlreadyWithdrawn();
        hasWithdrawn[id][key] = true;

        // Shares are computed against the frozen balance, never decremented —
        // otherwise earlier withdrawals would shrink later heirs' payouts.
        uint256 ethAmt = v.ethBalance * bps / BPS;
        if (ethAmt != 0) ethPaidOut[id] += ethAmt;

        address[] storage toks = v.tokens;
        for (uint256 i; i < toks.length; i++) {
            address t = toks[i];
            uint256 amt = tokenBalance[id][t] * bps / BPS;
            if (amt != 0) {
                tokenPaidOut[id][t] += amt;
                if (!IERC20(t).transfer(msg.sender, amt)) revert TransferFailed();
            }
        }

        NftRef[] storage nfts = heirNfts[id][key];
        uint256 nftCount = nfts.length;
        for (uint256 i; i < nftCount; i++) {
            IERC721(nfts[i].token).safeTransferFrom(address(this), msg.sender, nfts[i].tokenId);
        }
        delete heirNfts[id][key];

        emit ShareWithdrawn(id, msg.sender, ethAmt, nftCount);
        if (ethAmt != 0) {
            (bool ok,) = msg.sender.call{value: ethAmt}("");
            if (!ok) revert TransferFailed();
        }
    }

    /// @dev Needed to receive NFTs via safeTransferFrom.
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // ---------- views ----------

    function statusOf(uint256 id) public view returns (Status) {
        Vault storage v = vaults[id];
        if (v.finalized) {
            return (ethPaidOut[id] >= v.ethBalance) ? Status.Drained : Status.Claimable;
        }
        if (v.claimStart != 0) return Status.Challenged;
        if (block.timestamp > v.lastCheckIn + v.heartbeatInterval) return Status.Lapsed;
        return Status.Active;
    }

    function getVault(uint256 id) external view returns (
        address owner, address guardian, bool privateHeirs, uint64 heartbeatInterval,
        uint64 challengePeriod, uint64 lastCheckIn, uint64 claimStart, bool finalized, uint256 ethBalance
    ) {
        Vault storage v = vaults[id];
        return (v.owner, v.guardian, v.privateHeirs, v.heartbeatInterval, v.challengePeriod,
                v.lastCheckIn, v.claimStart, v.finalized, v.ethBalance);
    }

    /// @notice Heir keys (commitments for private vaults, addr-as-bytes32 for public ones).
    function heirKeysOf(uint256 id) external view returns (bytes32[] memory) { return heirKeys[id]; }
    /// @notice Plain heir addresses — empty for private vaults.
    function publicHeirsOf(uint256 id) external view returns (address[] memory) { return publicHeirs[id]; }
    function nftsOf(uint256 id, bytes32 heirKey) external view returns (NftRef[] memory) { return heirNfts[id][heirKey]; }
    function tokensOf(uint256 id) external view returns (address[] memory) { return vaults[id].tokens; }
    function ownedVaults(address owner) external view returns (uint256[] memory) { return vaultsByOwner[owner]; }
    function inheritedVaults(address heir) external view returns (uint256[] memory) { return vaultsByHeir[heir]; }
    function guardianVaults(address guardian) external view returns (uint256[] memory) { return vaultsByGuardian[guardian]; }
    function claimableAt(uint256 id) external view returns (uint64) {
        Vault storage v = vaults[id];
        if (v.claimStart == 0) return 0;
        return v.claimStart + v.challengePeriod;
    }
    function lapsesAt(uint256 id) external view returns (uint64) {
        Vault storage v = vaults[id];
        return v.lastCheckIn + v.heartbeatInterval;
    }

    // ---------- internals ----------

    function _setHeirs(uint256 id, address[] calldata heirs, bytes32[] calldata salts, uint16[] calldata sharesBps) internal {
        if (heirs.length != sharesBps.length || heirs.length != salts.length) revert BadShares();
        Vault storage v = vaults[id];
        uint256 total;
        for (uint256 i; i < heirs.length; i++) {
            if (sharesBps[i] == 0 || heirs[i] == address(0)) revert BadShares();
            bytes32 key = v.privateHeirs
                ? keccak256(abi.encodePacked(heirs[i], salts[i]))
                : bytes32(uint256(uint160(heirs[i])));
            if (shareOf[id][key] != 0) revert BadShares(); // duplicate heir/commitment
            shareOf[id][key] = sharesBps[i];
            heirKeys[id].push(key);
            if (!v.privateHeirs) {
                publicHeirs[id].push(heirs[i]);
                vaultsByHeir[heirs[i]].push(id);
            }
            total += sharesBps[i];
        }
        if (total != BPS) revert BadShares();
    }

    function _removeHeirIndex(address heir, uint256 id) internal {
        uint256[] storage list = vaultsByHeir[heir];
        for (uint256 i; i < list.length; i++) {
            if (list[i] == id) {
                list[i] = list[list.length - 1];
                list.pop();
                return;
            }
        }
    }

    function _removeGuardianIndex(address guardian, uint256 id) internal {
        uint256[] storage list = vaultsByGuardian[guardian];
        for (uint256 i; i < list.length; i++) {
            if (list[i] == id) {
                list[i] = list[list.length - 1];
                list.pop();
                return;
            }
        }
    }
}
