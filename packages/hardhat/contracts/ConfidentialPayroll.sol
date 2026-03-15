// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ConfidentialPayrollToken} from "./ConfidentialPayrollToken.sol";

/// @title ConfidentialPayroll
/// @notice A confidential onchain payroll system using Zama's fhEVM.
/// Salaries are encrypted with FHE — only the employer and respective employee can decrypt.
contract ConfidentialPayroll is ZamaEthereumConfig {

    // ─── Roles ────────────────────────────────────────────────────────────────
    address public employer;

    // ─── Employee data ────────────────────────────────────────────────────────
    struct Employee {
        bool active;
        euint64 salary; // encrypted monthly salary (token units)
    }

    mapping(address => Employee) private employees;
    address[] public employeeList;

    // ─── Payment token ────────────────────────────────────────────────────────
    // We interact with a ConfidentialERC20 for payments.
    // The employer must approve this contract to spend tokens on their behalf.
    address public paymentToken;

    // ─── Payroll history ──────────────────────────────────────────────────────
    struct PaymentRecord {
        uint256 timestamp;
        euint64 amount;
    }

    mapping(address => PaymentRecord[]) private paymentHistory;
    uint256 public lastPayrollTimestamp;
    uint256 public payrollCount;

    // ─── Aggregate stats (encrypted, employer-only) ───────────────────────────
    euint64 public totalPayrollBudget; // sum of all active salaries

    // ─── Events ───────────────────────────────────────────────────────────────
    event EmployeeAdded(address indexed employee);
    event EmployeeRemoved(address indexed employee);
    event SalaryUpdated(address indexed employee);
    event PayrollExecuted(uint256 indexed payrollId, uint256 employeeCount, uint256 timestamp);
    event PaymentTokenUpdated(address indexed token);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error OnlyEmployer();
    error EmployeeAlreadyExists();
    error EmployeeNotFound();
    error PaymentTokenNotSet();
    error NoActiveEmployees();

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyEmployer() {
        if (msg.sender != employer) revert OnlyEmployer();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _paymentToken) {
        employer = msg.sender;
        paymentToken = _paymentToken;
    }

    // ─── Employee Management ──────────────────────────────────────────────────

    /// @notice Add a new employee with an encrypted salary
    function addEmployee(
        address _employee,
        externalEuint64 _encryptedSalary,
        bytes calldata _inputProof
    ) external onlyEmployer {
        if (employees[_employee].active) revert EmployeeAlreadyExists();

        euint64 salary = FHE.fromExternal(_encryptedSalary, _inputProof);

        employees[_employee] = Employee({active: true, salary: salary});
        employeeList.push(_employee);

        // ACL: allow employer, employee, this contract, and the token contract to access the salary
        FHE.allow(salary, employer);
        FHE.allow(salary, _employee);
        FHE.allow(salary, paymentToken);
        FHE.allowThis(salary);

        // Update total budget
        totalPayrollBudget = FHE.add(totalPayrollBudget, salary);
        FHE.allow(totalPayrollBudget, employer);
        FHE.allowThis(totalPayrollBudget);

        emit EmployeeAdded(_employee);
    }

    /// @notice Update an employee's encrypted salary
    function updateSalary(
        address _employee,
        externalEuint64 _newEncryptedSalary,
        bytes calldata _inputProof
    ) external onlyEmployer {
        if (!employees[_employee].active) revert EmployeeNotFound();

        euint64 oldSalary = employees[_employee].salary;
        euint64 newSalary = FHE.fromExternal(_newEncryptedSalary, _inputProof);

        employees[_employee].salary = newSalary;

        // ACL for new salary
        FHE.allow(newSalary, employer);
        FHE.allow(newSalary, _employee);
        FHE.allow(newSalary, paymentToken);
        FHE.allowThis(newSalary);

        // Update total budget: subtract old, add new
        totalPayrollBudget = FHE.sub(totalPayrollBudget, oldSalary);
        totalPayrollBudget = FHE.add(totalPayrollBudget, newSalary);
        FHE.allow(totalPayrollBudget, employer);
        FHE.allowThis(totalPayrollBudget);

        emit SalaryUpdated(_employee);
    }

    /// @notice Remove an employee
    function removeEmployee(address _employee) external onlyEmployer {
        if (!employees[_employee].active) revert EmployeeNotFound();

        // Update total budget
        totalPayrollBudget = FHE.sub(totalPayrollBudget, employees[_employee].salary);
        FHE.allow(totalPayrollBudget, employer);
        FHE.allowThis(totalPayrollBudget);

        employees[_employee].active = false;

        // Remove from list
        for (uint256 i = 0; i < employeeList.length; i++) {
            if (employeeList[i] == _employee) {
                employeeList[i] = employeeList[employeeList.length - 1];
                employeeList.pop();
                break;
            }
        }

        emit EmployeeRemoved(_employee);
    }

    // ─── Payroll Execution ────────────────────────────────────────────────────

    /// @notice Execute payroll — transfers encrypted salary amounts to all active employees
    /// @dev The employer must have approved this contract to spend ConfidentialERC20 tokens.
    /// Uses confidentialTransferFrom on the payment token.
    function executePayroll() external onlyEmployer {
        if (paymentToken == address(0)) revert PaymentTokenNotSet();

        uint256 activeCount = 0;

        for (uint256 i = 0; i < employeeList.length; i++) {
            address emp = employeeList[i];
            if (!employees[emp].active) continue;

            euint64 salary = employees[emp].salary;

            // Direct call to ConfidentialPayrollToken.transferFrom
            ConfidentialPayrollToken(paymentToken).transferFrom(employer, emp, salary);

            // Record payment
            paymentHistory[emp].push(PaymentRecord({
                timestamp: block.timestamp,
                amount: salary
            }));

            // Allow employee and employer to decrypt the payment record
            FHE.allow(salary, emp);
            FHE.allow(salary, employer);

            activeCount++;
        }

        if (activeCount == 0) revert NoActiveEmployees();

        payrollCount++;
        lastPayrollTimestamp = block.timestamp;

        emit PayrollExecuted(payrollCount, activeCount, block.timestamp);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /// @notice Get the encrypted salary handle for an employee (only employer or the employee can decrypt)
    function getEmployeeSalary(address _employee) external view returns (euint64) {
        if (!employees[_employee].active) revert EmployeeNotFound();
        return employees[_employee].salary;
    }

    /// @notice Check if an address is an active employee
    function isEmployee(address _address) external view returns (bool) {
        return employees[_address].active;
    }

    /// @notice Get the number of active employees
    function getEmployeeCount() external view returns (uint256) {
        return employeeList.length;
    }

    /// @notice Get employee address by index
    function getEmployeeAt(uint256 index) external view returns (address) {
        return employeeList[index];
    }

    /// @notice Get all employee addresses
    function getAllEmployees() external view returns (address[] memory) {
        return employeeList;
    }

    /// @notice Get the total payroll budget (encrypted, employer-only)
    function getTotalPayrollBudget() external view returns (euint64) {
        return totalPayrollBudget;
    }

    /// @notice Get payment history count for an employee
    function getPaymentHistoryCount(address _employee) external view returns (uint256) {
        return paymentHistory[_employee].length;
    }

    /// @notice Get a specific payment record for an employee
    function getPaymentRecord(address _employee, uint256 index) external view returns (uint256 timestamp, euint64 amount) {
        PaymentRecord storage record = paymentHistory[_employee][index];
        return (record.timestamp, record.amount);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Update the payment token address
    function setPaymentToken(address _newToken) external onlyEmployer {
        paymentToken = _newToken;
        emit PaymentTokenUpdated(_newToken);
    }

    /// @notice Transfer employer role
    function transferEmployer(address _newEmployer) external onlyEmployer {
        employer = _newEmployer;
    }
}
