"use client";

import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface EmployeeOverviewProps {
  payroll: any;
  payrollAddress?: string;
  payrollAbi?: any[];
}

export function EmployeeOverviewView({ payroll, payrollAddress, payrollAbi }: EmployeeOverviewProps) {
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  const decryptedSalary = payroll.mySalaryHandle && payroll.mySalaryHandle !== ethers.ZeroHash
    ? payroll.salaryDecrypt.results[payroll.mySalaryHandle]
    : payroll.mySalaryHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const decryptedBalance = payroll.myBalanceHandle && payroll.myBalanceHandle !== ethers.ZeroHash
    ? payroll.balanceDecrypt.results[payroll.myBalanceHandle]
    : payroll.myBalanceHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const formatAmount = (val: bigint | undefined) => {
    if (val === undefined) return "***";
    return `${(Number(val) / 1_000_000).toFixed(2)}`;
  };

  const fetchPaymentHistory = useCallback(async () => {
    if (!payrollAddress || !payrollAbi || !payroll.accounts?.[0] || !payroll.ethersReadonlyProvider) return;
    try {
      const contract = new ethers.Contract(payrollAddress, payrollAbi, payroll.ethersReadonlyProvider);
      const count = await contract.getPaymentHistoryCount(payroll.accounts[0]);
      const records = [];
      for (let i = 0; i < Math.min(Number(count), 20); i++) {
        const record = await contract.getPaymentRecord(payroll.accounts[0], i);
        records.push({
          index: i,
          label: `Pay ${i + 1}`,
          timestamp: new Date(Number(record.timestamp) * 1000).toLocaleString(),
          date: new Date(Number(record.timestamp) * 1000).toLocaleDateString("en-US", { month: "short" }),
        });
      }
      setPaymentHistory(records);
    } catch {}
  }, [payrollAddress, payrollAbi, payroll.accounts, payroll.ethersReadonlyProvider]);

  useEffect(() => { fetchPaymentHistory(); }, [fetchPaymentHistory]);

  // Build chart data
  const chartData = paymentHistory.map((p, i) => ({
    name: p.date || `#${i + 1}`,
    amount: decryptedSalary !== undefined ? Number(decryptedSalary) / 1_000_000 : 5000,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">My Dashboard</h2>
        <p className="text-xs text-gray-400 font-mono mt-1">{payroll.accounts?.[0]}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-indigo-50 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-500 mb-2">My Monthly Salary</p>
          <p className="text-2xl font-bold text-gray-900">{formatAmount(decryptedSalary)} cUSDT</p>
          {payroll.salaryDecrypt.canDecrypt && decryptedSalary === undefined && (
            <button
              className="mt-2 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
              onClick={payroll.salaryDecrypt.decrypt}
              disabled={payroll.salaryDecrypt.isDecrypting}
            >
              {payroll.salaryDecrypt.isDecrypting ? "Decrypting..." : "Decrypt"}
            </button>
          )}
        </div>
        <div className="bg-green-50 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-500 mb-2">My cUSDT Balance</p>
          <p className="text-2xl font-bold text-gray-900">{formatAmount(decryptedBalance)} cUSDT</p>
          {payroll.balanceDecrypt.canDecrypt && decryptedBalance === undefined && (
            <button
              className="mt-2 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
              onClick={payroll.balanceDecrypt.decrypt}
              disabled={payroll.balanceDecrypt.isDecrypting}
            >
              {payroll.balanceDecrypt.isDecrypting ? "Decrypting..." : "Decrypt"}
            </button>
          )}
        </div>
        <div className="bg-amber-50 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-500 mb-2">Payments Received</p>
          <p className="text-2xl font-bold text-gray-900">{payroll.paymentHistoryCount}</p>
        </div>
      </div>

      {/* Payment History Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Payment History</h3>
        <div className="h-52">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} name="Amount (cUSDT)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No payments recorded yet</div>
          )}
        </div>
      </div>

      {/* Recent Payments Table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Payments</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paymentHistory.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No payments yet</td></tr>
              ) : (
                paymentHistory.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-500">{p.index + 1}</td>
                    <td className="py-3 text-gray-700">{p.timestamp}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-600">
                        {decryptedSalary !== undefined ? `${formatAmount(decryptedSalary)} cUSDT` : "Encrypted"}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-green-700 text-xs">Confirmed</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* On-Chain Proof */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">On-Chain Encrypted Handles</h3>
        <p className="text-xs text-gray-400 mb-4">These FHE ciphertext handles prove your encrypted data exists on-chain</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Salary Handle</p>
            <p className="font-mono text-xs break-all text-gray-600">{payroll.mySalaryHandle ?? "N/A"}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Balance Handle</p>
            <p className="font-mono text-xs break-all text-gray-600">{payroll.myBalanceHandle ?? "N/A"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
