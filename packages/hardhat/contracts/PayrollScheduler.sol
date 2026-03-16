// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PayrollScheduler
/// @notice Manages recurring payroll schedules with time-lock enforcement.
/// Prevents double-payment within a pay period and allows configurable
/// pay frequencies (weekly, bi-weekly, monthly).
/// Designed to work with Chainlink Automation or any keeper network.
contract PayrollScheduler {

    // ─── Types ─────────────────────────────────────────────────────────────
    enum PayFrequency {
        WEEKLY,         // 7 days
        BIWEEKLY,       // 14 days
        MONTHLY         // 30 days
    }

    struct Schedule {
        PayFrequency frequency;
        uint256 lastExecuted;
        uint256 nextPayDate;
        bool active;
        uint256 totalExecutions;
    }

    // ─── State ─────────────────────────────────────────────────────────────
    address public payrollContract;
    address public owner;
    Schedule public schedule;

    // Time-lock: minimum time between payroll executions
    mapping(PayFrequency => uint256) public frequencyDuration;

    // ─── Events ────────────────────────────────────────────────────────────
    event ScheduleCreated(PayFrequency frequency, uint256 firstPayDate);
    event ScheduleUpdated(PayFrequency frequency);
    event SchedulePaused();
    event ScheduleResumed();
    event PayrollTriggered(uint256 executionNumber, uint256 timestamp, uint256 nextPayDate);

    // ─── Errors ────────────────────────────────────────────────────────────
    error OnlyOwner();
    error ScheduleNotActive();
    error TooEarlyForPayroll();
    error ScheduleAlreadyActive();
    error InvalidPayrollContract();

    // ─── Modifiers ─────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────
    constructor(address _payrollContract) {
        if (_payrollContract == address(0)) revert InvalidPayrollContract();
        owner = msg.sender;
        payrollContract = _payrollContract;

        // Set frequency durations
        frequencyDuration[PayFrequency.WEEKLY] = 7 days;
        frequencyDuration[PayFrequency.BIWEEKLY] = 14 days;
        frequencyDuration[PayFrequency.MONTHLY] = 30 days;
    }

    // ─── Schedule Management ───────────────────────────────────────────────

    /// @notice Create a new payroll schedule
    /// @param _frequency How often payroll should be executed
    /// @param _firstPayDate Timestamp of the first pay date
    function createSchedule(PayFrequency _frequency, uint256 _firstPayDate) external onlyOwner {
        if (schedule.active) revert ScheduleAlreadyActive();

        schedule = Schedule({
            frequency: _frequency,
            lastExecuted: 0,
            nextPayDate: _firstPayDate,
            active: true,
            totalExecutions: 0
        });

        emit ScheduleCreated(_frequency, _firstPayDate);
    }

    /// @notice Update the pay frequency (takes effect after next execution)
    function updateFrequency(PayFrequency _frequency) external onlyOwner {
        schedule.frequency = _frequency;
        if (schedule.lastExecuted > 0) {
            schedule.nextPayDate = schedule.lastExecuted + frequencyDuration[_frequency];
        }
        emit ScheduleUpdated(_frequency);
    }

    /// @notice Pause the schedule
    function pauseSchedule() external onlyOwner {
        schedule.active = false;
        emit SchedulePaused();
    }

    /// @notice Resume the schedule
    function resumeSchedule() external onlyOwner {
        schedule.active = true;
        emit ScheduleResumed();
    }

    // ─── Payroll Trigger ───────────────────────────────────────────────────

    /// @notice Check if payroll can be executed now
    /// @return canExec Whether payroll can be triggered
    /// @return reason Human-readable reason if canExec is false
    function canExecutePayroll() external view returns (bool canExec, string memory reason) {
        if (!schedule.active) return (false, "Schedule not active");
        if (block.timestamp < schedule.nextPayDate) return (false, "Too early for next payroll");
        return (true, "Ready to execute");
    }

    /// @notice Trigger payroll execution (called by keeper or owner)
    /// @dev Calls executePayroll() on the payroll contract
    function triggerPayroll() external returns (bool) {
        if (!schedule.active) revert ScheduleNotActive();
        if (block.timestamp < schedule.nextPayDate) revert TooEarlyForPayroll();

        // Update schedule state BEFORE external call (reentrancy protection)
        schedule.lastExecuted = block.timestamp;
        schedule.totalExecutions++;
        schedule.nextPayDate = block.timestamp + frequencyDuration[schedule.frequency];

        // Call executePayroll on the payroll contract
        (bool success, ) = payrollContract.call(
            abi.encodeWithSignature("executePayroll()")
        );

        emit PayrollTriggered(schedule.totalExecutions, block.timestamp, schedule.nextPayDate);

        return success;
    }

    // ─── Chainlink Automation Compatible ───────────────────────────────────

    /// @notice Chainlink Automation checkUpkeep — returns true when payroll is due
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        upkeepNeeded = schedule.active && block.timestamp >= schedule.nextPayDate;
        performData = "";
    }

    /// @notice Chainlink Automation performUpkeep — executes the payroll
    function performUpkeep(bytes calldata) external {
        if (!schedule.active) revert ScheduleNotActive();
        if (block.timestamp < schedule.nextPayDate) revert TooEarlyForPayroll();

        schedule.lastExecuted = block.timestamp;
        schedule.totalExecutions++;
        schedule.nextPayDate = block.timestamp + frequencyDuration[schedule.frequency];

        (bool success, ) = payrollContract.call(
            abi.encodeWithSignature("executePayroll()")
        );
        require(success, "Payroll execution failed");

        emit PayrollTriggered(schedule.totalExecutions, block.timestamp, schedule.nextPayDate);
    }

    // ─── View Functions ────────────────────────────────────────────────────

    /// @notice Get full schedule info
    function getScheduleInfo() external view returns (
        PayFrequency frequency,
        uint256 lastExecuted,
        uint256 nextPayDate,
        bool active,
        uint256 totalExecutions
    ) {
        return (
            schedule.frequency,
            schedule.lastExecuted,
            schedule.nextPayDate,
            schedule.active,
            schedule.totalExecutions
        );
    }

    /// @notice Get time remaining until next payroll
    function timeUntilNextPayroll() external view returns (uint256) {
        if (!schedule.active) return type(uint256).max;
        if (block.timestamp >= schedule.nextPayDate) return 0;
        return schedule.nextPayDate - block.timestamp;
    }

    /// @notice Update payroll contract address
    function setPayrollContract(address _payrollContract) external onlyOwner {
        if (_payrollContract == address(0)) revert InvalidPayrollContract();
        payrollContract = _payrollContract;
    }

    /// @notice Transfer ownership
    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }
}
