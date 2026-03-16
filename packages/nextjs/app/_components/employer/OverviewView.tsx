"use client";

import { ethers } from "ethers";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// Simulated historical data based on on-chain payroll count
function generatePayrollHistory(payrollCount: number) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const now = new Date();
  const data = [];
  for (let i = 5; i >= 0; i--) {
    const monthIdx = (now.getMonth() - i + 12) % 12;
    const count = Math.max(0, payrollCount - i);
    data.push({
      month: months[monthIdx],
      volume: count * 5000 + Math.floor(Math.random() * 2000),
      dispatches: Math.max(0, count),
    });
  }
  return data;
}

interface OverviewViewProps {
  payroll: any;
}

export function OverviewView({ payroll }: OverviewViewProps) {
  const decryptedBudget = payroll.totalBudgetHandle && payroll.totalBudgetHandle !== ethers.ZeroHash
    ? payroll.budgetDecrypt.results[payroll.totalBudgetHandle]
    : payroll.totalBudgetHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const decryptedBalance = payroll.myBalanceHandle && payroll.myBalanceHandle !== ethers.ZeroHash
    ? payroll.balanceDecrypt.results[payroll.myBalanceHandle]
    : payroll.myBalanceHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const formatAmount = (val: bigint | undefined) => {
    if (val === undefined) return "Encrypted";
    return `${(Number(val) / 1_000_000).toFixed(2)}`;
  };

  const chartData = generatePayrollHistory(payroll.payrollCount);

  const recentActivity = [
    payroll.lastPayrollTimestamp > 0 && {
      hash: `0x${payroll.payrollAddress?.slice(2, 8)}...${payroll.payrollAddress?.slice(-4)}`,
      type: "Payroll Dispatch",
      status: "Confirmed",
      timestamp: new Date(payroll.lastPayrollTimestamp * 1000).toLocaleString(),
    },
    payroll.employeeCount > 0 && {
      hash: `0x${payroll.tokenAddress?.slice(2, 8)}...${payroll.tokenAddress?.slice(-4)}`,
      type: "Employee Onboard",
      status: "Confirmed",
      timestamp: new Date().toLocaleString(),
    },
    payroll.totalSupply > 0 && {
      hash: `0x${payroll.tokenAddress?.slice(2, 8)}...mint`,
      type: "Treasury Top-up",
      status: "Confirmed",
      timestamp: new Date().toLocaleString(),
    },
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Dashboard Overview</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={String(payroll.employeeCount)}
          change={payroll.employeeCount > 0 ? `+${payroll.employeeCount}` : "0"}
          positive={payroll.employeeCount > 0}
          bg="bg-rose-50"
        />
        <StatCard
          label="Active Payrolls"
          value={String(payroll.payrollCount)}
          change={payroll.payrollCount > 0 ? `+${payroll.payrollCount}` : "0%"}
          positive={payroll.payrollCount > 0}
          bg="bg-blue-50"
        />
        <StatCard
          label="Total Volume (Encrypted)"
          value={decryptedBudget !== undefined ? `${formatAmount(decryptedBudget)} cUSDT` : "Encrypted"}
          change=""
          positive
          bg="bg-amber-50"
          action={
            payroll.budgetDecrypt.canDecrypt ? (
              <button onClick={payroll.budgetDecrypt.decrypt} className="text-xs text-indigo-600 underline mt-1">
                Decrypt
              </button>
            ) : undefined
          }
        />
        <StatCard
          label="Your Balance"
          value={decryptedBalance !== undefined ? `${formatAmount(decryptedBalance)} cUSDT` : "Encrypted"}
          change=""
          positive
          bg="bg-green-50"
          action={
            payroll.balanceDecrypt.canDecrypt ? (
              <button onClick={payroll.balanceDecrypt.decrypt} className="text-xs text-indigo-600 underline mt-1">
                Decrypt
              </button>
            ) : undefined
          }
        />
      </div>

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Total Payroll Volume (Encrypted)</h3>
            <p className="text-xs text-gray-400">Historical processing volume</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {payroll.totalSupply > 0 ? `${(payroll.totalSupply / 1_000_000).toFixed(1)}` : "0"} cUSDT
            </p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}
              />
              <Area type="monotone" dataKey="volume" stroke="#6366f1" fillOpacity={1} fill="url(#colorVolume)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Recent Encrypted Activity</h3>
          <span className="text-xs text-indigo-600 cursor-pointer hover:underline">View All Ledger</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="pb-3 font-medium">Transaction Hash</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">No activity yet. Execute a payroll to see transactions.</td>
                </tr>
              ) : (
                recentActivity.map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 font-mono text-gray-600">{a.hash}</td>
                    <td className="py-3">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                        {a.type}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${a.status === "Confirmed" ? "bg-green-500" : "bg-amber-500"}`} />
                        <span className="text-gray-700">{a.status}</span>
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">{a.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, change, positive, bg, action,
}: {
  label: string; value: string; change: string; positive: boolean; bg: string; action?: React.ReactNode;
}) {
  return (
    <div className={`${bg} rounded-xl p-5`}>
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <div className="flex items-center gap-1 mt-1">
        {change && (
          <span className={`text-xs font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
            {positive ? "\u2197" : "\u2198"} {change}
          </span>
        )}
        {action}
      </div>
    </div>
  );
}
