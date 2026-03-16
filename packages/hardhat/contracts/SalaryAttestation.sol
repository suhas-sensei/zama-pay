// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SalaryAttestation
/// @notice Allows employees to generate on-chain attestations about their salary
/// without revealing the actual amount. Uses FHE comparisons to prove statements
/// like "my salary is above X" or "my salary is in range [X, Y]" — useful for
/// loan applications, rental agreements, visa proofs, etc.
///
/// The attestation is computed entirely on encrypted data — the actual salary
/// is never revealed on-chain. Only the boolean result is decryptable.
contract SalaryAttestation is ZamaEthereumConfig {

    // ─── Types ─────────────────────────────────────────────────────────────
    enum AttestationType {
        SALARY_ABOVE,           // salary >= threshold
        SALARY_BELOW,           // salary <= threshold
        SALARY_IN_RANGE,        // minThreshold <= salary <= maxThreshold
        EMPLOYMENT_ACTIVE       // is currently employed
    }

    struct Attestation {
        address employee;
        address verifier;       // who requested the attestation (landlord, bank, etc.)
        AttestationType attestationType;
        uint256 threshold;      // for ABOVE/BELOW
        uint256 minThreshold;   // for RANGE
        uint256 maxThreshold;   // for RANGE
        ebool result;           // encrypted boolean result
        uint256 timestamp;
        bool exists;
    }

    // ─── State ─────────────────────────────────────────────────────────────
    address public payrollContract;
    mapping(uint256 => Attestation) public attestations;
    uint256 public attestationCount;

    // Track attestations per employee
    mapping(address => uint256[]) private employeeAttestations;

    // ─── Events ────────────────────────────────────────────────────────────
    event AttestationCreated(
        uint256 indexed attestationId,
        address indexed employee,
        address indexed verifier,
        AttestationType attestationType
    );
    event AttestationRevoked(uint256 indexed attestationId);

    // ─── Errors ────────────────────────────────────────────────────────────
    error OnlyPayrollContract();
    error OnlyEmployee();
    error AttestationNotFound();
    error InvalidThreshold();

    // ─── Constructor ───────────────────────────────────────────────────────
    constructor(address _payrollContract) {
        payrollContract = _payrollContract;
    }

    // ─── Attestation Creation ──────────────────────────────────────────────

    /// @notice Create an attestation that salary >= threshold
    /// @param _employee The employee address
    /// @param _encryptedSalary The encrypted salary handle (from payroll contract)
    /// @param _threshold The plaintext threshold to compare against
    /// @param _verifier The address that will be allowed to decrypt the result
    function attestSalaryAbove(
        address _employee,
        euint64 _encryptedSalary,
        uint64 _threshold,
        address _verifier
    ) external returns (uint256) {
        if (msg.sender != _employee) revert OnlyEmployee();

        euint64 encThreshold = FHE.asEuint64(_threshold);
        ebool result = FHE.ge(_encryptedSalary, encThreshold);

        // Allow the verifier and employee to decrypt the result
        FHE.allow(result, _verifier);
        FHE.allow(result, _employee);
        FHE.allowThis(result);

        uint256 id = attestationCount++;
        attestations[id] = Attestation({
            employee: _employee,
            verifier: _verifier,
            attestationType: AttestationType.SALARY_ABOVE,
            threshold: _threshold,
            minThreshold: 0,
            maxThreshold: 0,
            result: result,
            timestamp: block.timestamp,
            exists: true
        });

        employeeAttestations[_employee].push(id);

        emit AttestationCreated(id, _employee, _verifier, AttestationType.SALARY_ABOVE);
        return id;
    }

    /// @notice Create an attestation that salary <= threshold
    function attestSalaryBelow(
        address _employee,
        euint64 _encryptedSalary,
        uint64 _threshold,
        address _verifier
    ) external returns (uint256) {
        if (msg.sender != _employee) revert OnlyEmployee();

        euint64 encThreshold = FHE.asEuint64(_threshold);
        ebool result = FHE.le(_encryptedSalary, encThreshold);

        FHE.allow(result, _verifier);
        FHE.allow(result, _employee);
        FHE.allowThis(result);

        uint256 id = attestationCount++;
        attestations[id] = Attestation({
            employee: _employee,
            verifier: _verifier,
            attestationType: AttestationType.SALARY_BELOW,
            threshold: _threshold,
            minThreshold: 0,
            maxThreshold: 0,
            result: result,
            timestamp: block.timestamp,
            exists: true
        });

        employeeAttestations[_employee].push(id);

        emit AttestationCreated(id, _employee, _verifier, AttestationType.SALARY_BELOW);
        return id;
    }

    /// @notice Create an attestation that minThreshold <= salary <= maxThreshold
    function attestSalaryInRange(
        address _employee,
        euint64 _encryptedSalary,
        uint64 _minThreshold,
        uint64 _maxThreshold,
        address _verifier
    ) external returns (uint256) {
        if (msg.sender != _employee) revert OnlyEmployee();
        if (_minThreshold > _maxThreshold) revert InvalidThreshold();

        euint64 encMin = FHE.asEuint64(_minThreshold);
        euint64 encMax = FHE.asEuint64(_maxThreshold);

        ebool aboveMin = FHE.ge(_encryptedSalary, encMin);
        ebool belowMax = FHE.le(_encryptedSalary, encMax);

        // AND both conditions: salary >= min AND salary <= max
        ebool result = FHE.and(aboveMin, belowMax);

        FHE.allow(result, _verifier);
        FHE.allow(result, _employee);
        FHE.allowThis(result);

        uint256 id = attestationCount++;
        attestations[id] = Attestation({
            employee: _employee,
            verifier: _verifier,
            attestationType: AttestationType.SALARY_IN_RANGE,
            threshold: 0,
            minThreshold: _minThreshold,
            maxThreshold: _maxThreshold,
            result: result,
            timestamp: block.timestamp,
            exists: true
        });

        employeeAttestations[_employee].push(id);

        emit AttestationCreated(id, _employee, _verifier, AttestationType.SALARY_IN_RANGE);
        return id;
    }

    // ─── View Functions ────────────────────────────────────────────────────

    /// @notice Get the encrypted result of an attestation
    function getAttestationResult(uint256 _id) external view returns (ebool) {
        if (!attestations[_id].exists) revert AttestationNotFound();
        return attestations[_id].result;
    }

    /// @notice Get attestation details (without the encrypted result)
    function getAttestationInfo(uint256 _id) external view returns (
        address employee,
        address verifier,
        AttestationType attestationType,
        uint256 threshold,
        uint256 minThreshold,
        uint256 maxThreshold,
        uint256 timestamp
    ) {
        if (!attestations[_id].exists) revert AttestationNotFound();
        Attestation storage a = attestations[_id];
        return (a.employee, a.verifier, a.attestationType, a.threshold, a.minThreshold, a.maxThreshold, a.timestamp);
    }

    /// @notice Get all attestation IDs for an employee
    function getEmployeeAttestations(address _employee) external view returns (uint256[] memory) {
        return employeeAttestations[_employee];
    }

    /// @notice Get attestation count for an employee
    function getEmployeeAttestationCount(address _employee) external view returns (uint256) {
        return employeeAttestations[_employee].length;
    }
}
