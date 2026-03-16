// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ConfidentialPayrollToken} from "./ConfidentialPayrollToken.sol";
import {PayrollAccessControl} from "./PayrollAccessControl.sol";

/// @title ConfidentialPayroll
/// @notice A confidential onchain payroll system using Zama's fhEVM.
/// Salaries are encrypted with FHE — only the employer and respective employee can decrypt.
/// Integrates role-based access control, salary attestation, and scheduled payroll.
contract ConfidentialPayroll is ZamaEthereumConfig {

    // ─── Roles ────────────────────────────────────────────────────────────────
    address public employer;

    // ─── Connected contracts ──────────────────────────────────────────────────
    address public paymentToken;
    address public accessControl;      // PayrollAccessControl
    address public scheduler;          // PayrollScheduler (authorized to call executePayroll)
    address public attestationContract; // SalaryAttestation (authorized to read salary handles)

    // ─── Employee data ────────────────────────────────────────────────────────
    struct Employee {
        bool active;
        euint64 salary;
        string department;
        uint256 addedAt;
    }

    mapping(address => Employee) private employees;
    address[] public employeeList;

    // ─── Reimbursement requests ───────────────────────────────────────────────
    struct ReimbursementRequest {
        address employee;
        euint64 amount;
        string description;
        uint256 timestamp;
        bool approved;
        bool processed;
    }

    ReimbursementRequest[] public reimbursements;
    mapping(address => uint256[]) private employeeReimbursements;

    // ─── Payroll history ──────────────────────────────────────────────────────
    struct PaymentRecord {
        uint256 timestamp;
        euint64 amount;
    }

    mapping(address => PaymentRecord[]) private paymentHistory;
    uint256 public lastPayrollTimestamp;
    uint256 public payrollCount;

    // ─── Aggregate stats ──────────────────────────────────────────────────────
    euint64 public totalPayrollBudget;

    // ─── Events ───────────────────────────────────────────────────────────────
    event EmployeeAdded(address indexed employee, string department);
    event EmployeeRemoved(address indexed employee);
    event SalaryUpdated(address indexed employee);
    event PayrollExecuted(uint256 indexed payrollId, uint256 employeeCount, uint256 timestamp);
    event PaymentTokenUpdated(address indexed token);
    event ReimbursementRequested(uint256 indexed requestId, address indexed employee);
    event ReimbursementApproved(uint256 indexed requestId);
    event ReimbursementProcessed(uint256 indexed requestId);
    event ContractLinked(string contractType, address contractAddress);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error OnlyEmployer();
    error OnlyEmployerOrHR();
    error OnlyEmployerOrFinance();
    error OnlyEmployerOrScheduler();
    error OnlyEmployee();
    error EmployeeAlreadyExists();
    error EmployeeNotFound();
    error PaymentTokenNotSet();
    error NoActiveEmployees();
    error ReimbursementNotFound();
    error ReimbursementAlreadyProcessed();

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyEmployer() {
        if (msg.sender != employer) revert OnlyEmployer();
        _;
    }

    modifier onlyEmployerOrHR() {
        if (msg.sender != employer) {
            if (accessControl == address(0)) revert OnlyEmployerOrHR();
            if (!PayrollAccessControl(accessControl).canManageEmployees(msg.sender))
                revert OnlyEmployerOrHR();
        }
        _;
    }

    modifier onlyEmployerOrFinance() {
        if (msg.sender != employer) {
            if (accessControl == address(0)) revert OnlyEmployerOrFinance();
            if (!PayrollAccessControl(accessControl).canManageFinances(msg.sender))
                revert OnlyEmployerOrFinance();
        }
        _;
    }

    modifier onlyEmployerOrScheduler() {
        if (msg.sender != employer && msg.sender != scheduler)
            revert OnlyEmployerOrScheduler();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _paymentToken) {
        employer = msg.sender;
        paymentToken = _paymentToken;
    }

    // ─── Contract Linking ─────────────────────────────────────────────────────

    function setAccessControl(address _accessControl) external onlyEmployer {
        accessControl = _accessControl;
        emit ContractLinked("AccessControl", _accessControl);
    }

    function setScheduler(address _scheduler) external onlyEmployer {
        scheduler = _scheduler;
        emit ContractLinked("Scheduler", _scheduler);
    }

    function setAttestationContract(address _attestation) external onlyEmployer {
        attestationContract = _attestation;
        emit ContractLinked("Attestation", _attestation);
    }

    // ─── Employee Management (Employer or HR) ─────────────────────────────────

    function addEmployee(
        address _employee,
        externalEuint64 _encryptedSalary,
        bytes calldata _inputProof
    ) external onlyEmployerOrHR {
        _addEmployeeWithDept(_employee, _encryptedSalary, _inputProof, "General");
    }

    function addEmployeeWithDepartment(
        address _employee,
        externalEuint64 _encryptedSalary,
        bytes calldata _inputProof,
        string calldata _department
    ) external onlyEmployerOrHR {
        _addEmployeeWithDept(_employee, _encryptedSalary, _inputProof, _department);
    }

    function _addEmployeeWithDept(
        address _employee,
        externalEuint64 _encryptedSalary,
        bytes calldata _inputProof,
        string memory _department
    ) internal {
        if (employees[_employee].active) revert EmployeeAlreadyExists();

        euint64 salary = FHE.fromExternal(_encryptedSalary, _inputProof);

        employees[_employee] = Employee({
            active: true,
            salary: salary,
            department: _department,
            addedAt: block.timestamp
        });
        employeeList.push(_employee);

        // ACL: employer, employee, token, attestation contract
        FHE.allow(salary, employer);
        FHE.allow(salary, _employee);
        FHE.allow(salary, paymentToken);
        FHE.allowThis(salary);
        if (attestationContract != address(0)) {
            FHE.allow(salary, attestationContract);
        }

        totalPayrollBudget = FHE.add(totalPayrollBudget, salary);
        FHE.allow(totalPayrollBudget, employer);
        FHE.allowThis(totalPayrollBudget);

        emit EmployeeAdded(_employee, _department);
    }

    /// @notice Update salary (employer only — HR cannot see salaries)
    function updateSalary(
        address _employee,
        externalEuint64 _newEncryptedSalary,
        bytes calldata _inputProof
    ) external onlyEmployer {
        if (!employees[_employee].active) revert EmployeeNotFound();

        euint64 oldSalary = employees[_employee].salary;
        euint64 newSalary = FHE.fromExternal(_newEncryptedSalary, _inputProof);

        employees[_employee].salary = newSalary;

        FHE.allow(newSalary, employer);
        FHE.allow(newSalary, _employee);
        FHE.allow(newSalary, paymentToken);
        FHE.allowThis(newSalary);
        if (attestationContract != address(0)) {
            FHE.allow(newSalary, attestationContract);
        }

        totalPayrollBudget = FHE.sub(totalPayrollBudget, oldSalary);
        totalPayrollBudget = FHE.add(totalPayrollBudget, newSalary);
        FHE.allow(totalPayrollBudget, employer);
        FHE.allowThis(totalPayrollBudget);

        emit SalaryUpdated(_employee);
    }

    /// @notice Remove employee (employer or HR)
    function removeEmployee(address _employee) external onlyEmployerOrHR {
        if (!employees[_employee].active) revert EmployeeNotFound();

        totalPayrollBudget = FHE.sub(totalPayrollBudget, employees[_employee].salary);
        FHE.allow(totalPayrollBudget, employer);
        FHE.allowThis(totalPayrollBudget);

        employees[_employee].active = false;

        for (uint256 i = 0; i < employeeList.length; i++) {
            if (employeeList[i] == _employee) {
                employeeList[i] = employeeList[employeeList.length - 1];
                employeeList.pop();
                break;
            }
        }

        emit EmployeeRemoved(_employee);
    }

    // ─── Payroll Execution (Employer, Finance, or Scheduler) ──────────────────

    function executePayroll() external onlyEmployerOrScheduler {
        if (paymentToken == address(0)) revert PaymentTokenNotSet();

        uint256 activeCount = 0;

        for (uint256 i = 0; i < employeeList.length; i++) {
            address emp = employeeList[i];
            if (!employees[emp].active) continue;

            euint64 salary = employees[emp].salary;

            ConfidentialPayrollToken(paymentToken).transferFrom(employer, emp, salary);

            paymentHistory[emp].push(PaymentRecord({
                timestamp: block.timestamp,
                amount: salary
            }));

            FHE.allow(salary, emp);
            FHE.allow(salary, employer);

            activeCount++;
        }

        if (activeCount == 0) revert NoActiveEmployees();

        payrollCount++;
        lastPayrollTimestamp = block.timestamp;

        emit PayrollExecuted(payrollCount, activeCount, block.timestamp);
    }

    // ─── Reimbursements (Employee Self-Service) ───────────────────────────────

    /// @notice Employee submits an encrypted reimbursement request
    function requestReimbursement(
        externalEuint64 _encryptedAmount,
        bytes calldata _inputProof,
        string calldata _description
    ) external {
        if (!employees[msg.sender].active) revert OnlyEmployee();

        euint64 amount = FHE.fromExternal(_encryptedAmount, _inputProof);
        FHE.allow(amount, employer);
        FHE.allow(amount, msg.sender);
        FHE.allowThis(amount);

        uint256 id = reimbursements.length;
        reimbursements.push(ReimbursementRequest({
            employee: msg.sender,
            amount: amount,
            description: _description,
            timestamp: block.timestamp,
            approved: false,
            processed: false
        }));

        employeeReimbursements[msg.sender].push(id);

        emit ReimbursementRequested(id, msg.sender);
    }

    /// @notice Employer approves a reimbursement
    function approveReimbursement(uint256 _requestId) external onlyEmployerOrFinance {
        if (_requestId >= reimbursements.length) revert ReimbursementNotFound();
        if (reimbursements[_requestId].processed) revert ReimbursementAlreadyProcessed();

        reimbursements[_requestId].approved = true;
        emit ReimbursementApproved(_requestId);
    }

    /// @notice Process an approved reimbursement (transfer tokens)
    function processReimbursement(uint256 _requestId) external onlyEmployerOrFinance {
        if (_requestId >= reimbursements.length) revert ReimbursementNotFound();
        ReimbursementRequest storage req = reimbursements[_requestId];
        if (req.processed) revert ReimbursementAlreadyProcessed();
        require(req.approved, "Not approved");

        ConfidentialPayrollToken(paymentToken).transferFrom(employer, req.employee, req.amount);
        req.processed = true;

        emit ReimbursementProcessed(_requestId);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getEmployeeSalary(address _employee) external view returns (euint64) {
        if (!employees[_employee].active) revert EmployeeNotFound();
        return employees[_employee].salary;
    }

    function getEmployeeInfo(address _employee) external view returns (
        bool active,
        string memory department,
        uint256 addedAt
    ) {
        Employee storage emp = employees[_employee];
        return (emp.active, emp.department, emp.addedAt);
    }

    function isEmployee(address _address) external view returns (bool) {
        return employees[_address].active;
    }

    function getEmployeeCount() external view returns (uint256) {
        return employeeList.length;
    }

    function getEmployeeAt(uint256 index) external view returns (address) {
        return employeeList[index];
    }

    function getAllEmployees() external view returns (address[] memory) {
        return employeeList;
    }

    function getTotalPayrollBudget() external view returns (euint64) {
        return totalPayrollBudget;
    }

    function getPaymentHistoryCount(address _employee) external view returns (uint256) {
        return paymentHistory[_employee].length;
    }

    function getPaymentRecord(address _employee, uint256 index) external view returns (uint256 timestamp, euint64 amount) {
        PaymentRecord storage record = paymentHistory[_employee][index];
        return (record.timestamp, record.amount);
    }

    function getReimbursementCount() external view returns (uint256) {
        return reimbursements.length;
    }

    function getEmployeeReimbursements(address _employee) external view returns (uint256[] memory) {
        return employeeReimbursements[_employee];
    }

    function getReimbursement(uint256 _id) external view returns (
        address employee,
        string memory description,
        uint256 timestamp,
        bool approved,
        bool processed
    ) {
        ReimbursementRequest storage req = reimbursements[_id];
        return (req.employee, req.description, req.timestamp, req.approved, req.processed);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setPaymentToken(address _newToken) external onlyEmployer {
        paymentToken = _newToken;
        emit PaymentTokenUpdated(_newToken);
    }

    function transferEmployer(address _newEmployer) external onlyEmployer {
        employer = _newEmployer;
    }
}
