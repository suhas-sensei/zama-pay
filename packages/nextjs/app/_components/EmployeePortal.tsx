"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { SalaryAttestationPanel } from "./SalaryAttestationPanel";

interface EmployeePortalProps {
  payroll: any;
  attestationAddress?: string;
  attestationAbi?: any[];
  payrollAddress?: string;
  payrollAbi?: any[];
}

export const EmployeePortal = ({ payroll, attestationAddress, attestationAbi, payrollAddress, payrollAbi }: EmployeePortalProps) => {
  const [reimbDescription, setReimbDescription] = useState("");
  const [reimbAmount, setReimbAmount] = useState("");
  const [reimbursements, setReimbursements] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reimbMessage, setReimbMessage] = useState("");

  const decryptedSalary = payroll.mySalaryHandle && payroll.mySalaryHandle !== ethers.ZeroHash
    ? payroll.salaryDecrypt.results[payroll.mySalaryHandle]
    : payroll.mySalaryHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const decryptedBalance = payroll.myBalanceHandle && payroll.myBalanceHandle !== ethers.ZeroHash
    ? payroll.balanceDecrypt.results[payroll.myBalanceHandle]
    : payroll.myBalanceHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const formatAmount = (val: bigint | undefined) => {
    if (val === undefined) return "Encrypted";
    return `${(Number(val) / 1_000_000).toFixed(2)} cUSDT`;
  };

  const fetchPaymentHistory = useCallback(async () => {
    if (!payrollAddress || !payrollAbi || !payroll.accounts?.[0]) return;
    try {
      if (!payroll.ethersReadonlyProvider) return;
      const contract = new ethers.Contract(payrollAddress, payrollAbi, payroll.ethersReadonlyProvider);
      const count = await contract.getPaymentHistoryCount(payroll.accounts[0]);
      const records = [];
      for (let i = 0; i < Math.min(Number(count), 20); i++) {
        const record = await contract.getPaymentRecord(payroll.accounts[0], i);
        records.push({
          index: i,
          timestamp: new Date(Number(record.timestamp) * 1000).toLocaleString(),
          amountHandle: record.amount,
        });
      }
      setPaymentHistory(records);
    } catch {}
  }, [payrollAddress, payrollAbi, payroll.accounts]);

  const fetchReimbursements = useCallback(async () => {
    if (!payrollAddress || !payrollAbi || !payroll.accounts?.[0]) return;
    try {
      if (!payroll.ethersReadonlyProvider) return;
      const contract = new ethers.Contract(payrollAddress, payrollAbi, payroll.ethersReadonlyProvider);
      // Attempt to fetch reimbursement requests if the contract supports it
      if (!contract.getReimbursementCount) return;
      const count = await contract.getReimbursementCount(payroll.accounts[0]);
      const reqs = [];
      for (let i = 0; i < Math.min(Number(count), 20); i++) {
        const req = await contract.getReimbursement(payroll.accounts[0], i);
        reqs.push({
          index: i,
          description: req.description || req[0],
          status: ["Pending", "Approved", "Rejected"][Number(req.status ?? req[2])] || "Unknown",
          timestamp: new Date(Number(req.timestamp ?? req[3]) * 1000).toLocaleString(),
        });
      }
      setReimbursements(reqs);
    } catch {}
  }, [payrollAddress, payrollAbi, payroll.accounts]);

  useEffect(() => {
    if (payroll.isEmployeeUser) {
      fetchPaymentHistory();
      fetchReimbursements();
    }
  }, [payroll.isEmployeeUser, fetchPaymentHistory, fetchReimbursements]);

  const submitReimbursement = async () => {
    if (!payrollAddress || !payrollAbi || !reimbDescription || !reimbAmount) return;
    setIsSubmitting(true);
    setReimbMessage("Submitting reimbursement request...");
    try {
      if (!payroll.ethersSigner) return;
      const contract = new ethers.Contract(payrollAddress, payrollAbi, payroll.ethersSigner);
      const amountUnits = Math.round(parseFloat(reimbAmount) * 1_000_000);
      const tx = await contract.requestReimbursement(reimbDescription, amountUnits);
      await tx.wait();
      setReimbMessage("Reimbursement request submitted!");
      setReimbDescription("");
      setReimbAmount("");
      fetchReimbursements();
    } catch (e) {
      setReimbMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!payroll.isEmployeeUser) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="bg-white border border-gray-200 p-8">
          <div className="text-4xl mb-4">?</div>
          <h2 className="text-xl font-bold mb-2 text-gray-900">Not Registered</h2>
          <p className="text-gray-600">
            Your wallet address is not registered as an employee in this payroll system.
            Contact your employer to be added.
          </p>
          <p className="text-gray-400 text-sm mt-4 font-mono">
            {payroll.accounts?.[0] ?? "Not connected"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-white border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-1 text-gray-900">My Payroll Dashboard</h2>
        <p className="text-gray-500 text-sm font-mono">{payroll.accounts?.[0]}</p>
      </div>

      {/* Key Figures */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Salary */}
        <div className="bg-white border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-1">My Monthly Salary</p>
          <p className="text-2xl font-bold text-gray-900">
            {decryptedSalary !== undefined ? formatAmount(decryptedSalary) : "***"}
          </p>
          {payroll.salaryDecrypt.canDecrypt && (
            <button
              className="mt-2 text-sm bg-black text-white px-4 py-2 hover:bg-gray-800"
              onClick={payroll.salaryDecrypt.decrypt}
              disabled={payroll.salaryDecrypt.isDecrypting}
            >
              {payroll.salaryDecrypt.isDecrypting ? "Decrypting..." : "Decrypt Salary"}
            </button>
          )}
          {payroll.salaryDecrypt.isDecrypting && (
            <p className="text-sm text-gray-500 mt-2">Decrypting...</p>
          )}
        </div>

        {/* Balance */}
        <div className="bg-white border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-1">My cUSDT Balance</p>
          <p className="text-2xl font-bold text-gray-900">
            {decryptedBalance !== undefined ? formatAmount(decryptedBalance) : "***"}
          </p>
          {payroll.balanceDecrypt.canDecrypt && (
            <button
              className="mt-2 text-sm bg-black text-white px-4 py-2 hover:bg-gray-800"
              onClick={payroll.balanceDecrypt.decrypt}
              disabled={payroll.balanceDecrypt.isDecrypting}
            >
              {payroll.balanceDecrypt.isDecrypting ? "Decrypting..." : "Decrypt Balance"}
            </button>
          )}
        </div>

        {/* Payments Received */}
        <div className="bg-white border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-1">Payments Received</p>
          <p className="text-2xl font-bold text-gray-900">{payroll.paymentHistoryCount}</p>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-2 text-gray-900">Payment History</h3>
        <p className="text-gray-500 text-sm mb-4">
          All salary payments received on-chain. Amounts are encrypted — only you can decrypt them.
        </p>
        <button className="text-blue-600 text-sm underline mb-3" onClick={fetchPaymentHistory}>Refresh</button>
        {paymentHistory.length === 0 ? (
          <p className="text-gray-500 text-sm">No payments recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {paymentHistory.map((p, i) => (
              <div key={i} className="flex justify-between items-center py-3 px-4 bg-gray-50 border border-gray-200 text-sm">
                <span className="text-gray-900 font-medium">Payment #{p.index + 1}</span>
                <span className="text-gray-500 font-mono text-xs">{p.amountHandle.slice(0, 14)}...</span>
                <span className="text-gray-500">{p.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reimbursement Request */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-2 text-gray-900">Reimbursement Requests</h3>
        <p className="text-gray-500 text-sm mb-4">
          Submit reimbursement requests to your employer. The amount is sent encrypted on-chain.
        </p>

        {reimbMessage && (
          <div className="bg-gray-100 border border-gray-300 px-3 py-2 text-sm text-gray-700 mb-4">{reimbMessage}</div>
        )}

        <div className="space-y-3 mb-6">
          <input
            type="text"
            placeholder="Description (e.g. Conference travel expenses)"
            className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
            value={reimbDescription}
            onChange={e => setReimbDescription(e.target.value)}
          />
          <input
            type="number"
            placeholder="Amount (cUSDT, e.g. 500)"
            className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
            value={reimbAmount}
            onChange={e => setReimbAmount(e.target.value)}
          />
          <button
            className="w-full bg-indigo-600 text-white py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50"
            disabled={isSubmitting || !reimbDescription || !reimbAmount}
            onClick={submitReimbursement}
          >
            {isSubmitting ? "Submitting..." : "Submit Reimbursement Request"}
          </button>
        </div>

        <h4 className="font-semibold text-gray-800 mb-2">Past Requests</h4>
        <button className="text-blue-600 text-sm underline mb-3" onClick={fetchReimbursements}>Refresh</button>
        {reimbursements.length === 0 ? (
          <p className="text-gray-500 text-sm">No reimbursement requests yet.</p>
        ) : (
          <div className="space-y-2">
            {reimbursements.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-3 px-4 bg-gray-50 border border-gray-200 text-sm">
                <div>
                  <span className="font-medium text-gray-900">{r.description}</span>
                  <span className="ml-2 text-gray-500 text-xs">{r.timestamp}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 ${
                  r.status === "Approved" ? "bg-green-100 text-green-700" :
                  r.status === "Rejected" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Salary Attestation */}
      {attestationAddress && attestationAbi && (
        <SalaryAttestationPanel
          payroll={payroll}
          attestationAddress={attestationAddress}
          attestationAbi={attestationAbi}
          payrollAddress={payrollAddress}
          payrollAbi={payrollAbi}
        />
      )}

      {/* Encrypted Handles (debug/proof) */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4 text-gray-900">On-Chain Proof</h3>
        <p className="text-gray-600 text-sm mb-4">
          These are your encrypted data handles on-chain. Only you and the employer can decrypt them.
        </p>
        <div className="space-y-3">
          <div className="bg-gray-50 p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Salary Handle</p>
            <p className="font-mono text-xs break-all text-gray-700">
              {payroll.mySalaryHandle ?? "N/A"}
            </p>
          </div>
          <div className="bg-gray-50 p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Balance Handle</p>
            <p className="font-mono text-xs break-all text-gray-700">
              {payroll.myBalanceHandle ?? "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 p-4">
        <p className="text-blue-800 text-sm">
          Your salary and balance are fully encrypted on-chain using Fully Homomorphic Encryption (FHE).
          No one — not even validators — can see your salary amount. Only you and the employer have decryption access.
        </p>
      </div>
    </div>
  );
};
