// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PayrollAccessControl
/// @notice Role-based access control for the confidential payroll system.
/// Supports four roles: Owner, HR Admin, Finance (CFO), and Auditor.
/// - Owner: full control, can assign/revoke all roles
/// - HR Admin: can add/remove employees but CANNOT see salaries
/// - Finance: can see aggregate budget, execute payroll, mint tokens
/// - Auditor: can verify payroll was executed (event logs) but cannot see individual salaries
contract PayrollAccessControl {

    // ─── Role Definitions ──────────────────────────────────────────────────
    enum Role {
        NONE,
        HR_ADMIN,
        FINANCE,
        AUDITOR
    }

    // ─── State ─────────────────────────────────────────────────────────────
    address public owner;
    mapping(address => Role) public roles;
    address[] public roleHolders;

    // ─── Events ────────────────────────────────────────────────────────────
    event RoleGranted(address indexed account, Role role);
    event RoleRevoked(address indexed account, Role previousRole);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Errors ────────────────────────────────────────────────────────────
    error OnlyOwner();
    error OnlyRole(Role required);
    error OnlyOwnerOrRole(Role required);
    error CannotRevokeOwner();
    error InvalidAddress();
    error RoleAlreadyAssigned();

    // ─── Modifiers ─────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyRole(Role _role) {
        if (roles[msg.sender] != _role) revert OnlyRole(_role);
        _;
    }

    modifier onlyOwnerOrRole(Role _role) {
        if (msg.sender != owner && roles[msg.sender] != _role)
            revert OnlyOwnerOrRole(_role);
        _;
    }

    modifier onlyHROrOwner() {
        if (msg.sender != owner && roles[msg.sender] != Role.HR_ADMIN)
            revert OnlyOwnerOrRole(Role.HR_ADMIN);
        _;
    }

    modifier onlyFinanceOrOwner() {
        if (msg.sender != owner && roles[msg.sender] != Role.FINANCE)
            revert OnlyOwnerOrRole(Role.FINANCE);
        _;
    }

    modifier onlyAuditorOrOwner() {
        if (msg.sender != owner && roles[msg.sender] != Role.AUDITOR)
            revert OnlyOwnerOrRole(Role.AUDITOR);
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ─── Role Management ───────────────────────────────────────────────────

    /// @notice Grant a role to an address (only owner)
    function grantRole(address _account, Role _role) external onlyOwner {
        if (_account == address(0)) revert InvalidAddress();
        if (_role == Role.NONE) revert InvalidAddress();

        if (roles[_account] == Role.NONE) {
            roleHolders.push(_account);
        }

        roles[_account] = _role;
        emit RoleGranted(_account, _role);
    }

    /// @notice Revoke a role from an address (only owner)
    function revokeRole(address _account) external onlyOwner {
        if (_account == owner) revert CannotRevokeOwner();

        Role previousRole = roles[_account];
        roles[_account] = Role.NONE;

        // Remove from roleHolders
        for (uint256 i = 0; i < roleHolders.length; i++) {
            if (roleHolders[i] == _account) {
                roleHolders[i] = roleHolders[roleHolders.length - 1];
                roleHolders.pop();
                break;
            }
        }

        emit RoleRevoked(_account, previousRole);
    }

    /// @notice Transfer ownership
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert InvalidAddress();
        address prev = owner;
        owner = _newOwner;
        emit OwnerTransferred(prev, _newOwner);
    }

    // ─── View Functions ────────────────────────────────────────────────────

    /// @notice Check if address has a specific role
    function hasRole(address _account, Role _role) external view returns (bool) {
        return roles[_account] == _role;
    }

    /// @notice Check if address is owner or has a specific role
    function isOwnerOrRole(address _account, Role _role) external view returns (bool) {
        return _account == owner || roles[_account] == _role;
    }

    /// @notice Get all role holders
    function getAllRoleHolders() external view returns (address[] memory accounts, Role[] memory assignedRoles) {
        accounts = roleHolders;
        assignedRoles = new Role[](roleHolders.length);
        for (uint256 i = 0; i < roleHolders.length; i++) {
            assignedRoles[i] = roles[roleHolders[i]];
        }
    }

    /// @notice Get role holder count
    function getRoleHolderCount() external view returns (uint256) {
        return roleHolders.length;
    }

    /// @notice Check if caller can manage employees (owner or HR)
    function canManageEmployees(address _caller) external view returns (bool) {
        return _caller == owner || roles[_caller] == Role.HR_ADMIN;
    }

    /// @notice Check if caller can manage finances (owner or Finance)
    function canManageFinances(address _caller) external view returns (bool) {
        return _caller == owner || roles[_caller] == Role.FINANCE;
    }

    /// @notice Check if caller can audit (owner or Auditor)
    function canAudit(address _caller) external view returns (bool) {
        return _caller == owner || roles[_caller] == Role.AUDITOR;
    }
}
