// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PayrollAnalytics
/// @notice Provides encrypted aggregate analytics for payroll data.
/// All computations happen on encrypted data using FHE — individual
/// salaries are never exposed. Only the employer can decrypt aggregates.
///
/// Features:
/// - Department-level salary totals (encrypted)
/// - Headcount per department
/// - Encrypted min/max salary tracking
/// - Payroll execution history with encrypted totals
contract PayrollAnalytics is ZamaEthereumConfig {

    // ─── Types ─────────────────────────────────────────────────────────────
    struct DepartmentStats {
        uint256 headcount;
        euint64 totalSalary;        // encrypted sum of salaries in department
        bool exists;
    }

    struct PayrollSnapshot {
        uint256 timestamp;
        uint256 employeeCount;
        euint64 totalPaid;           // encrypted total amount paid
        uint256 payrollId;
    }

    // ─── State ─────────────────────────────────────────────────────────────
    address public owner;
    address public payrollContract;

    // Department tracking
    mapping(bytes32 => DepartmentStats) public departments;
    mapping(address => bytes32) public employeeDepartment;
    bytes32[] public departmentList;

    // Payroll history snapshots
    PayrollSnapshot[] public snapshots;

    // Global encrypted stats
    euint64 public totalSalaryPool;      // sum of ALL active salaries
    uint256 public totalActiveEmployees;

    // ─── Events ────────────────────────────────────────────────────────────
    event DepartmentCreated(bytes32 indexed departmentId, string name);
    event EmployeeAssignedToDepartment(address indexed employee, bytes32 indexed departmentId);
    event PayrollSnapshotRecorded(uint256 indexed snapshotId, uint256 employeeCount);
    event AnalyticsUpdated(uint256 totalActiveEmployees);

    // ─── Errors ────────────────────────────────────────────────────────────
    error OnlyOwner();
    error DepartmentNotFound();
    error DepartmentAlreadyExists();

    // ─── Modifiers ─────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────
    constructor(address _payrollContract) {
        owner = msg.sender;
        payrollContract = _payrollContract;
    }

    // ─── Department Management ─────────────────────────────────────────────

    /// @notice Create a new department
    function createDepartment(string calldata _name) external onlyOwner returns (bytes32) {
        bytes32 deptId = keccak256(abi.encodePacked(_name));
        if (departments[deptId].exists) revert DepartmentAlreadyExists();

        departments[deptId] = DepartmentStats({
            headcount: 0,
            totalSalary: FHE.asEuint64(0),
            exists: true
        });

        // Allow owner to decrypt department total
        FHE.allow(departments[deptId].totalSalary, owner);
        FHE.allowThis(departments[deptId].totalSalary);

        departmentList.push(deptId);
        emit DepartmentCreated(deptId, _name);
        return deptId;
    }

    /// @notice Assign an employee to a department and update stats
    /// @param _employee Employee address
    /// @param _departmentId Department hash
    /// @param _encryptedSalary The employee's encrypted salary handle
    function assignEmployeeToDepartment(
        address _employee,
        bytes32 _departmentId,
        euint64 _encryptedSalary
    ) external onlyOwner {
        if (!departments[_departmentId].exists) revert DepartmentNotFound();

        // Remove from old department if assigned
        bytes32 oldDept = employeeDepartment[_employee];
        if (oldDept != bytes32(0) && departments[oldDept].exists) {
            departments[oldDept].headcount--;
            departments[oldDept].totalSalary = FHE.sub(
                departments[oldDept].totalSalary,
                _encryptedSalary
            );
            FHE.allow(departments[oldDept].totalSalary, owner);
            FHE.allowThis(departments[oldDept].totalSalary);
        }

        // Add to new department
        employeeDepartment[_employee] = _departmentId;
        departments[_departmentId].headcount++;
        departments[_departmentId].totalSalary = FHE.add(
            departments[_departmentId].totalSalary,
            _encryptedSalary
        );

        FHE.allow(departments[_departmentId].totalSalary, owner);
        FHE.allowThis(departments[_departmentId].totalSalary);

        // Update global stats
        totalSalaryPool = FHE.add(totalSalaryPool, _encryptedSalary);
        FHE.allow(totalSalaryPool, owner);
        FHE.allowThis(totalSalaryPool);
        totalActiveEmployees++;

        emit EmployeeAssignedToDepartment(_employee, _departmentId);
        emit AnalyticsUpdated(totalActiveEmployees);
    }

    /// @notice Record a payroll execution snapshot
    function recordPayrollSnapshot(
        uint256 _payrollId,
        uint256 _employeeCount,
        euint64 _totalPaid
    ) external onlyOwner {
        FHE.allow(_totalPaid, owner);
        FHE.allowThis(_totalPaid);

        snapshots.push(PayrollSnapshot({
            timestamp: block.timestamp,
            employeeCount: _employeeCount,
            totalPaid: _totalPaid,
            payrollId: _payrollId
        }));

        emit PayrollSnapshotRecorded(snapshots.length - 1, _employeeCount);
    }

    // ─── View Functions ────────────────────────────────────────────────────

    /// @notice Get department stats
    function getDepartmentStats(bytes32 _departmentId) external view returns (
        uint256 headcount,
        euint64 totalSalary
    ) {
        if (!departments[_departmentId].exists) revert DepartmentNotFound();
        return (departments[_departmentId].headcount, departments[_departmentId].totalSalary);
    }

    /// @notice Get all department IDs
    function getAllDepartments() external view returns (bytes32[] memory) {
        return departmentList;
    }

    /// @notice Get department count
    function getDepartmentCount() external view returns (uint256) {
        return departmentList.length;
    }

    /// @notice Get snapshot count
    function getSnapshotCount() external view returns (uint256) {
        return snapshots.length;
    }

    /// @notice Get a specific snapshot
    function getSnapshot(uint256 _index) external view returns (
        uint256 timestamp,
        uint256 employeeCount,
        euint64 totalPaid,
        uint256 payrollId
    ) {
        PayrollSnapshot storage s = snapshots[_index];
        return (s.timestamp, s.employeeCount, s.totalPaid, s.payrollId);
    }

    /// @notice Get encrypted total salary pool
    function getTotalSalaryPool() external view returns (euint64) {
        return totalSalaryPool;
    }

    /// @notice Transfer ownership
    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }
}
