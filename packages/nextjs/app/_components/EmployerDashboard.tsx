"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { RoleManagement } from "./RoleManagement";
import { PayrollSchedulerPanel } from "./PayrollSchedulerPanel";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

interface EmployerDashboardProps {
  payroll: any;
  accessControlAddress?: string;
  accessControlAbi?: any[];
  schedulerAddress?: string;
  schedulerAbi?: any[];
  analyticsAddress?: string;
  analyticsAbi?: any[];
  payrollAddress?: string;
  payrollAbi?: any[];
}

export const EmployerDashboard = ({
  payroll,
  accessControlAddress,
  accessControlAbi,
  schedulerAddress,
  schedulerAbi,
  analyticsAddress,
  analyticsAbi,
  payrollAddress,
  payrollAbi,
}: EmployerDashboardProps) => {
  const [newEmployeeAddress, setNewEmployeeAddress] = useState("");
  const [newEmployeeSalary, setNewEmployeeSalary] = useState("");
  const [updateAddress, setUpdateAddress] = useState("");
  const [updateSalaryValue, setUpdateSalaryValue] = useState("");
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [removeAddr, setRemoveAddr] = useState("");
  const [pendingReimbursements, setPendingReimbursements] = useState<any[]>([]);
  const [reimbMessage, setReimbMessage] = useState("");
  const [reimbLoading, setReimbLoading] = useState(false);

  // Decrypted values
  const decryptedBudget = payroll.totalBudgetHandle && payroll.totalBudgetHandle !== ethers.ZeroHash
    ? payroll.budgetDecrypt.results[payroll.totalBudgetHandle]
    : payroll.totalBudgetHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const decryptedBalance = payroll.myBalanceHandle && payroll.myBalanceHandle !== ethers.ZeroHash
    ? payroll.balanceDecrypt.results[payroll.myBalanceHandle]
    : payroll.myBalanceHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const formatAmount = (val: bigint | undefined) => {
    if (val === undefined) return "Encrypted";
    return `${(Number(val) / 1_000_000).toFixed(2)} cUSDT`;
  };

  const fetchReimbursements = useCallback(async () => {
    if (!payrollAddress || !payrollAbi) return;
    try {
      if (!payroll.ethersReadonlyProvider) return;
      const contract = new ethers.Contract(payrollAddress, payrollAbi, payroll.ethersReadonlyProvider);
      if (!contract.getPendingReimbursements) return;
      const pending = await contract.getPendingReimbursements();
      const reqs = [];
      for (const item of pending) {
        reqs.push({
          employee: item.employee ?? item[0],
          index: Number(item.index ?? item[1]),
          description: item.description ?? item[2],
          timestamp: new Date(Number(item.timestamp ?? item[3]) * 1000).toLocaleString(),
        });
      }
      setPendingReimbursements(reqs);
    } catch {}
  }, [payrollAddress, payrollAbi]);

  useEffect(() => { fetchReimbursements(); }, [fetchReimbursements]);

  const handleReimbursement = async (employee: string, index: number, approve: boolean) => {
    if (!payrollAddress || !payrollAbi) return;
    setReimbLoading(true);
    setReimbMessage(approve ? "Approving..." : "Rejecting...");
    try {
      if (!payroll.ethersSigner) return;
      const contract = new ethers.Contract(payrollAddress, payrollAbi, payroll.ethersSigner);
      const tx = approve
        ? await contract.approveReimbursement(employee, index)
        : await contract.rejectReimbursement(employee, index);
      await tx.wait();
      setReimbMessage(approve ? "Reimbursement approved!" : "Reimbursement rejected.");
      fetchReimbursements();
    } catch (e) {
      setReimbMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReimbLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Employees"
          value={String(payroll.employeeCount)}
        />
        <StatCard
          title="Payrolls Run"
          value={String(payroll.payrollCount)}
        />
        <StatCard
          title="Total Budget"
          value={decryptedBudget !== undefined ? formatAmount(decryptedBudget) : "Encrypted"}
          action={
            payroll.budgetDecrypt.canDecrypt ? (
              <button
                className="text-xs text-blue-600 underline mt-1"
                onClick={payroll.budgetDecrypt.decrypt}
              >
                Decrypt
              </button>
            ) : undefined
          }
        />
        <StatCard
          title="Your Balance"
          value={decryptedBalance !== undefined ? formatAmount(decryptedBalance) : "Encrypted"}
          action={
            payroll.balanceDecrypt.canDecrypt ? (
              <button
                className="text-xs text-blue-600 underline mt-1"
                onClick={payroll.balanceDecrypt.decrypt}
              >
                Decrypt
              </button>
            ) : undefined
          }
        />
      </div>

      {/* Last Payroll */}
      {payroll.lastPayrollTimestamp > 0 && (
        <div className="bg-green-50 border border-green-200 p-4">
          <p className="text-green-800 text-sm">
            Last payroll executed: {new Date(payroll.lastPayrollTimestamp * 1000).toLocaleString()}
          </p>
        </div>
      )}

      {/* Operator Approval */}
      {!payroll.isPayrollApproved && (
        <div className="bg-yellow-50 border border-yellow-300 p-4">
          <p className="text-yellow-800 font-medium mb-2">
            Payroll contract is not approved to transfer tokens on your behalf.
          </p>
          <button
            className="bg-yellow-600 text-white px-4 py-2 font-medium hover:bg-yellow-700 disabled:opacity-50"
            disabled={payroll.isProcessing}
            onClick={payroll.approvePayrollOperator}
          >
            Approve Payroll Contract
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Employee */}
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-bold mb-4 text-gray-900">Add Employee</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Employee address (0x...)"
              className="w-full border border-gray-300 p-3 text-sm font-mono text-gray-900 bg-white"
              value={newEmployeeAddress}
              onChange={e => setNewEmployeeAddress(e.target.value)}
            />
            <input
              type="number"
              placeholder="Monthly salary (cUSDT, e.g. 5000)"
              className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
              value={newEmployeeSalary}
              onChange={e => setNewEmployeeSalary(e.target.value)}
            />
            <button
              className="w-full bg-black text-white py-3 font-semibold hover:bg-gray-800 disabled:opacity-50"
              disabled={payroll.isProcessing || !newEmployeeAddress || !newEmployeeSalary}
              onClick={() => {
                const salaryInUnits = Math.round(parseFloat(newEmployeeSalary) * 1_000_000);
                payroll.addEmployee(newEmployeeAddress, salaryInUnits);
                setNewEmployeeAddress("");
                setNewEmployeeSalary("");
              }}
            >
              {payroll.isProcessing ? "Processing..." : "Add Employee"}
            </button>
          </div>
        </div>

        {/* Mint Tokens */}
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-bold mb-4 text-gray-900">Mint cUSDT</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Recipient address (0x...)"
              className="w-full border border-gray-300 p-3 text-sm font-mono text-gray-900 bg-white"
              value={mintTo}
              onChange={e => setMintTo(e.target.value)}
            />
            <input
              type="number"
              placeholder="Amount (e.g. 100000)"
              className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
              value={mintAmount}
              onChange={e => setMintAmount(e.target.value)}
            />
            <button
              className="w-full bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
              disabled={payroll.isProcessing || !mintTo || !mintAmount}
              onClick={() => {
                const amountInUnits = Math.round(parseFloat(mintAmount) * 1_000_000);
                payroll.mintTokens(mintTo, amountInUnits);
                setMintTo("");
                setMintAmount("");
              }}
            >
              {payroll.isProcessing ? "Processing..." : "Mint Tokens"}
            </button>
          </div>
        </div>

        {/* Update Salary */}
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-bold mb-4 text-gray-900">Update Salary</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Employee address (0x...)"
              className="w-full border border-gray-300 p-3 text-sm font-mono text-gray-900 bg-white"
              value={updateAddress}
              onChange={e => setUpdateAddress(e.target.value)}
            />
            <input
              type="number"
              placeholder="New monthly salary (cUSDT)"
              className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
              value={updateSalaryValue}
              onChange={e => setUpdateSalaryValue(e.target.value)}
            />
            <button
              className="w-full bg-gray-700 text-white py-3 font-semibold hover:bg-gray-800 disabled:opacity-50"
              disabled={payroll.isProcessing || !updateAddress || !updateSalaryValue}
              onClick={() => {
                const salaryInUnits = Math.round(parseFloat(updateSalaryValue) * 1_000_000);
                payroll.updateSalary(updateAddress, salaryInUnits);
                setUpdateAddress("");
                setUpdateSalaryValue("");
              }}
            >
              {payroll.isProcessing ? "Processing..." : "Update Salary"}
            </button>
          </div>
        </div>

        {/* Remove Employee */}
        <div className="bg-white border border-gray-200 p-6">
          <h3 className="text-lg font-bold mb-4 text-gray-900">Remove Employee</h3>
          <div className="space-y-3">
            <select
              className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
              value={removeAddr}
              onChange={e => setRemoveAddr(e.target.value)}
            >
              <option value="">Select employee...</option>
              {payroll.employeeAddresses.map((addr: string) => (
                <option key={addr} value={addr}>
                  {addr.slice(0, 6)}...{addr.slice(-4)}
                </option>
              ))}
            </select>
            <button
              className="w-full bg-red-600 text-white py-3 font-semibold hover:bg-red-700 disabled:opacity-50"
              disabled={payroll.isProcessing || !removeAddr}
              onClick={() => {
                payroll.removeEmployee(removeAddr);
                setRemoveAddr("");
              }}
            >
              {payroll.isProcessing ? "Processing..." : "Remove Employee"}
            </button>
          </div>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4 text-gray-900">Active Employees</h3>
        {payroll.employeeAddresses.length === 0 ? (
          <p className="text-gray-500">No employees added yet.</p>
        ) : (
          <div className="space-y-2">
            {payroll.employeeAddresses.map((addr: string, i: number) => (
              <div key={addr} className="flex items-center justify-between py-3 px-4 bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">#{i + 1}</span>
                  <span className="font-mono text-sm text-gray-900">{addr}</span>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1">Active</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execute Payroll */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-2 text-gray-900">Execute Payroll</h3>
        <p className="text-gray-600 text-sm mb-4">
          This will transfer encrypted salary amounts to all active employees.
          Ensure you have minted enough cUSDT and approved the payroll contract.
        </p>
        <button
          className="w-full bg-green-600 text-white py-4 font-bold text-lg hover:bg-green-700 disabled:opacity-50"
          disabled={payroll.isProcessing || payroll.employeeCount === 0 || !payroll.isPayrollApproved}
          onClick={payroll.executePayroll}
        >
          {payroll.isProcessing ? "Processing..." : `Execute Payroll (${payroll.employeeCount} employees)`}
        </button>
        {!payroll.isPayrollApproved && payroll.employeeCount > 0 && (
          <p className="text-red-500 text-sm mt-2">You must approve the payroll contract first.</p>
        )}
      </div>

      {/* Reimbursement Approvals */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-2 text-gray-900">Reimbursement Approvals</h3>
        <p className="text-gray-500 text-sm mb-4">
          Review and approve or reject employee reimbursement requests.
        </p>

        {reimbMessage && (
          <div className="bg-gray-100 border border-gray-300 px-3 py-2 text-sm text-gray-700 mb-4">{reimbMessage}</div>
        )}

        <button className="text-blue-600 text-sm underline mb-3" onClick={fetchReimbursements}>Refresh</button>
        {pendingReimbursements.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending reimbursement requests.</p>
        ) : (
          <div className="space-y-2">
            {pendingReimbursements.map((r, i) => (
              <div key={i} className="py-3 px-4 bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-gray-900 text-sm">{r.description}</span>
                    <span className="ml-2 text-gray-500 text-xs">{r.timestamp}</span>
                  </div>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5">Pending</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-600">
                    {r.employee.slice(0, 10)}...{r.employee.slice(-6)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="bg-green-600 text-white px-4 py-1 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      disabled={reimbLoading}
                      onClick={() => handleReimbursement(r.employee, r.index, true)}
                    >
                      Approve
                    </button>
                    <button
                      className="bg-red-600 text-white px-4 py-1 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      disabled={reimbLoading}
                      onClick={() => handleReimbursement(r.employee, r.index, false)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role Management */}
      {accessControlAddress && accessControlAbi && (
        <RoleManagement
          payroll={payroll}
          accessControlAddress={accessControlAddress}
          accessControlAbi={accessControlAbi}
        />
      )}

      {/* Payroll Scheduler */}
      {schedulerAddress && schedulerAbi && (
        <PayrollSchedulerPanel
          payroll={payroll}
          schedulerAddress={schedulerAddress}
          schedulerAbi={schedulerAbi}
        />
      )}

      {/* Analytics Dashboard */}
      {analyticsAddress && analyticsAbi && (
        <AnalyticsDashboard
          payroll={payroll}
          analyticsAddress={analyticsAddress}
          analyticsAbi={analyticsAbi}
        />
      )}
    </div>
  );
};

function StatCard({ title, value, action }: { title: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 p-5">
      <p className="text-gray-500 text-sm mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {action}
    </div>
  );
}
