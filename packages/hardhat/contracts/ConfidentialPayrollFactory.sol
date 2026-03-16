// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConfidentialPayroll} from "./ConfidentialPayroll.sol";
import {ConfidentialPayrollToken} from "./ConfidentialPayrollToken.sol";
import {PayrollAccessControl} from "./PayrollAccessControl.sol";
import {PayrollScheduler} from "./PayrollScheduler.sol";
import {SalaryAttestation} from "./SalaryAttestation.sol";

/// @title ConfidentialPayrollFactory
/// @notice Factory contract that deploys a complete payroll suite for each company.
/// Each deployment creates: PayrollToken, Payroll, AccessControl, Scheduler, and Attestation contracts.
/// This allows multiple companies to use the system independently.
contract ConfidentialPayrollFactory {

    // ─── Types ─────────────────────────────────────────────────────────────
    struct CompanyDeployment {
        address owner;
        address payrollToken;
        address payroll;
        address accessControl;
        address scheduler;
        address attestation;
        string companyName;
        uint256 deployedAt;
        bool active;
    }

    // ─── State ─────────────────────────────────────────────────────────────
    mapping(uint256 => CompanyDeployment) public deployments;
    mapping(address => uint256[]) public ownerDeployments;
    uint256 public deploymentCount;

    // ─── Events ────────────────────────────────────────────────────────────
    event CompanyDeployed(
        uint256 indexed deploymentId,
        address indexed owner,
        string companyName,
        address payrollToken,
        address payroll,
        address accessControl,
        address scheduler,
        address attestation
    );

    // ─── Factory Function ──────────────────────────────────────────────────

    /// @notice Deploy a complete payroll suite for a new company
    /// @param _companyName Human-readable company name
    /// @param _tokenName Name for the confidential payment token
    /// @param _tokenSymbol Symbol for the confidential payment token
    function deployPayrollSuite(
        string calldata _companyName,
        string calldata _tokenName,
        string calldata _tokenSymbol
    ) external returns (uint256 deploymentId) {
        // 1. Deploy the confidential payment token
        ConfidentialPayrollToken token = new ConfidentialPayrollToken(_tokenName, _tokenSymbol);

        // 2. Deploy the main payroll contract
        ConfidentialPayroll payroll = new ConfidentialPayroll(address(token));

        // 3. Deploy access control
        PayrollAccessControl accessControl = new PayrollAccessControl();

        // 4. Deploy scheduler
        PayrollScheduler scheduler = new PayrollScheduler(address(payroll));

        // 5. Deploy salary attestation
        SalaryAttestation attestation = new SalaryAttestation(address(payroll));

        // 6. Transfer ownership of all contracts to the caller
        token.transferOwnership(msg.sender);
        payroll.transferEmployer(msg.sender);
        accessControl.transferOwnership(msg.sender);
        scheduler.transferOwnership(msg.sender);

        // 7. Store deployment info
        deploymentId = deploymentCount++;
        deployments[deploymentId] = CompanyDeployment({
            owner: msg.sender,
            payrollToken: address(token),
            payroll: address(payroll),
            accessControl: address(accessControl),
            scheduler: address(scheduler),
            attestation: address(attestation),
            companyName: _companyName,
            deployedAt: block.timestamp,
            active: true
        });

        ownerDeployments[msg.sender].push(deploymentId);

        emit CompanyDeployed(
            deploymentId,
            msg.sender,
            _companyName,
            address(token),
            address(payroll),
            address(accessControl),
            address(scheduler),
            address(attestation)
        );
    }

    // ─── View Functions ────────────────────────────────────────────────────

    /// @notice Get all deployment IDs for an owner
    function getOwnerDeployments(address _owner) external view returns (uint256[] memory) {
        return ownerDeployments[_owner];
    }

    /// @notice Get deployment details
    function getDeployment(uint256 _id) external view returns (CompanyDeployment memory) {
        return deployments[_id];
    }

    /// @notice Get total number of deployments
    function getTotalDeployments() external view returns (uint256) {
        return deploymentCount;
    }
}
