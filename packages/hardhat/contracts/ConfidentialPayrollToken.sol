// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialPayrollToken
/// @notice A minimal confidential ERC20 token for payroll payments.
/// Balances and transfer amounts are encrypted using FHE.
contract ConfidentialPayrollToken is ZamaEthereumConfig {

    string public name;
    string public symbol;
    uint8 public constant decimals = 6; // USDT-like

    // Encrypted balances
    mapping(address => euint64) private _balances;

    // Operator approvals (address => operator => approved)
    mapping(address => mapping(address => bool)) private _operators;

    // Total supply (plaintext for simplicity — only the distribution is confidential)
    uint256 public totalSupply;

    address public owner;

    event Transfer(address indexed from, address indexed to);
    event OperatorSet(address indexed owner, address indexed operator, bool approved);
    event Mint(address indexed to, uint256 amount);

    error OnlyOwner();
    error NotOperator();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
    }

    /// @notice Mint tokens to an address (plaintext amount, stored encrypted)
    function mint(address to, uint64 amount) external onlyOwner {
        euint64 encAmount = FHE.asEuint64(amount);
        _balances[to] = FHE.add(_balances[to], encAmount);

        FHE.allow(_balances[to], to);
        FHE.allow(_balances[to], address(this));
        FHE.allowThis(_balances[to]);

        totalSupply += amount;

        emit Mint(to, amount);
    }

    /// @notice Get the encrypted balance handle (caller must be allowed to decrypt)
    function balanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /// @notice Set operator approval (for payroll contract to transfer on behalf of employer)
    function setOperator(address operator, bool approved) external {
        _operators[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    /// @notice Check if an address is an approved operator
    function isOperator(address _owner, address operator) external view returns (bool) {
        return _operators[_owner][operator];
    }

    /// @notice Confidential transfer — sender transfers encrypted amount
    function transfer(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _transfer(msg.sender, to, amount);
    }

    /// @notice Transfer using an already-encrypted handle (used by payroll contract)
    function transferFrom(address from, address to, euint64 amount) external {
        // Caller must be an approved operator
        if (!_operators[from][msg.sender]) revert NotOperator();

        _transfer(from, to, amount);
    }

    /// @notice Internal transfer logic with encrypted amounts
    function _transfer(address from, address to, euint64 amount) internal {
        // Check balance >= amount (FHE comparison)
        ebool hasEnough = FHE.ge(_balances[from], amount);

        // Conditional transfer: only executes if balance is sufficient
        euint64 transferAmount = FHE.select(hasEnough, amount, FHE.asEuint64(0));

        _balances[from] = FHE.sub(_balances[from], transferAmount);
        _balances[to] = FHE.add(_balances[to], transferAmount);

        // ACL: allow relevant parties to decrypt their own balance
        FHE.allow(_balances[from], from);
        FHE.allow(_balances[from], address(this));
        FHE.allowThis(_balances[from]);

        FHE.allow(_balances[to], to);
        FHE.allow(_balances[to], address(this));
        FHE.allowThis(_balances[to]);

        emit Transfer(from, to);
    }

    /// @notice Transfer ownership of the token contract
    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }
}
