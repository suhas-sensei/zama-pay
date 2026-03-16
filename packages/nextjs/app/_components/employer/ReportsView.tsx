"use client";

import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

interface ReportsViewProps {
  payroll: any;
  analyticsAddress?: string;
  analyticsAbi?: any[];
  accessControlAddress?: string;
  accessControlAbi?: any[];
  employeeSalaryDecrypt?: any;
  decryptedSalaryMap?: Record<string, number>;
}

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

export function ReportsView({
  payroll,
  analyticsAddress,
  analyticsAbi,
  accessControlAddress,
  accessControlAbi,
  employeeSalaryDecrypt,
  decryptedSalaryMap,
}: ReportsViewProps) {
  const [departments, setDepartments] = useState<string[]>([]);
  const [roles, setRoles] = useState<{ address: string; role: string }[]>([]);
  const [pendingReimbursements, setPendingReimbursements] = useState<any[]>([]);
  const [reimbMessage, setReimbMessage] = useState("");


  // Fetch departments
  const fetchAnalytics = useCallback(async () => {
    if (!analyticsAddress || !analyticsAbi || !payroll.ethersReadonlyProvider) return;
    try {
      const contract = new ethers.Contract(analyticsAddress, analyticsAbi, payroll.ethersReadonlyProvider);
      if (contract.getDepartments) {
        const depts = await contract.getDepartments();
        setDepartments(depts);
      }
    } catch {}
  }, [analyticsAddress, analyticsAbi, payroll.ethersReadonlyProvider]);

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    if (!accessControlAddress || !accessControlAbi || !payroll.ethersReadonlyProvider) return;
    try {
      const contract = new ethers.Contract(accessControlAddress, accessControlAbi, payroll.ethersReadonlyProvider);
      const roleNames = ["HR_ADMIN", "FINANCE", "AUDITOR"];
      const found: { address: string; role: string }[] = [];
      for (const rn of roleNames) {
        try {
          const members = await contract.getRoleMembers(rn);
          if (members && members.length > 0) {
            for (const m of members) {
              found.push({ address: m, role: rn });
            }
          }
        } catch {}
      }
      setRoles(found);
    } catch {}
  }, [accessControlAddress, accessControlAbi, payroll.ethersReadonlyProvider]);

  // Fetch reimbursements using actual contract functions
  const fetchReimbursements = useCallback(async () => {
    if (!payroll.payrollAddress || !payroll.ethersReadonlyProvider) return;
    try {
      const contract = new ethers.Contract(
        payroll.payrollAddress,
        [
          "function getReimbursementCount() view returns (uint256)",
          "function getReimbursement(uint256) view returns (address employee, string description, uint256 timestamp, bool approved, bool processed)",
        ],
        payroll.ethersReadonlyProvider
      );
      const count = await contract.getReimbursementCount();
      const pending: any[] = [];
      for (let i = 0; i < Math.min(Number(count), 50); i++) {
        const req = await contract.getReimbursement(i);
        if (!req.processed && !req.approved) {
          pending.push({
            employee: req.employee,
            index: i,
            description: req.description,
            timestamp: new Date(Number(req.timestamp) * 1000).toLocaleString(),
          });
        }
      }
      setPendingReimbursements(pending);
    } catch {}
  }, [payroll.payrollAddress, payroll.ethersReadonlyProvider]);

  useEffect(() => {
    fetchAnalytics();
    fetchRoles();
    fetchReimbursements();
  }, [fetchAnalytics, fetchRoles, fetchReimbursements]);

  const handleReimbursement = async (requestId: number, approve: boolean) => {
    if (!payroll.ethersSigner || !payroll.payrollAddress) return;
    setReimbMessage(approve ? "Approving..." : "Rejecting...");
    try {
      const contract = new ethers.Contract(
        payroll.payrollAddress,
        [
          "function approveReimbursement(uint256) external",
        ],
        payroll.ethersSigner
      );
      if (approve) {
        const tx = await contract.approveReimbursement(requestId);
        await tx.wait();
        setReimbMessage("Approved!");
      } else {
        setReimbMessage("Reject not supported — only approve or ignore.");
      }
      fetchReimbursements();
    } catch (e) {
      setReimbMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const salaryMap = decryptedSalaryMap ?? {};
  const isDecrypted = Object.keys(salaryMap).length > 0;

  // Build chart data
  const payrollHistory = Array.from({ length: Math.min(payroll.payrollCount, 6) }, (_, i) => {
    const totalPerRun = isDecrypted
      ? Object.values(salaryMap).reduce((sum: number, v: number) => sum + v, 0)
      : payroll.employeeCount * 5000;
    return {
      run: `Run ${i + 1}`,
      employees: payroll.employeeCount,
      amount: totalPerRun,
    };
  });

  const distributionData = payroll.employeeAddresses.map((addr: string) => ({
    name: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
    value: isDecrypted ? (salaryMap[addr] ?? 1) : 1,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Reports & Analytics</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-indigo-50 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Total Payroll Runs</p>
          <p className="text-3xl font-bold text-gray-900">{payroll.payrollCount}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Total Supply Minted</p>
          <p className="text-3xl font-bold text-gray-900">
            {payroll.totalSupply > 0 ? `${(payroll.totalSupply / 1_000_000).toFixed(0)}` : "0"} cUSDT
          </p>
        </div>
        <div className="bg-amber-50 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Departments</p>
          <p className="text-3xl font-bold text-gray-900">{departments.length || 0}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll History Bar Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Payroll History</h3>
          <div className="h-52">
            {payrollHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payrollHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="run" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                  <Bar dataKey="employees" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No payroll data yet</div>
            )}
          </div>
        </div>

        {/* Salary Distribution Pie */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 !m-0">Salary Distribution</h3>
            {!isDecrypted && payroll.employeeAddresses.length > 0 && employeeSalaryDecrypt && (
              <button
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                onClick={() => employeeSalaryDecrypt.decrypt()}
                disabled={employeeSalaryDecrypt.isDecrypting || !employeeSalaryDecrypt.canDecrypt}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                {employeeSalaryDecrypt.isDecrypting ? "Decrypting..." : !employeeSalaryDecrypt.canDecrypt ? "Loading..." : "Decrypt to View"}
              </button>
            )}
          </div>
          <div className={`h-52 ${!isDecrypted && payroll.employeeAddresses.length > 0 ? "opacity-20 blur-sm pointer-events-none" : ""}`}>
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value.toLocaleString()} cUSDT)`}>
                    {distributionData.map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No employees yet</div>
            )}
          </div>
          {!isDecrypted && payroll.employeeAddresses.length > 0 && (
            <div className="absolute inset-0 top-14 flex items-center justify-center pointer-events-none">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl px-6 py-4 text-center shadow-lg">
                <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <p className="text-sm text-gray-600 font-medium !m-0">Encrypted Data</p>
                <p className="text-xs text-gray-400 !m-0">Decrypt salaries to view distribution</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Roles */}
      {roles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Role Assignments</h3>
          <div className="space-y-2">
            {roles.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-4 bg-gray-50 rounded-lg">
                <span className="font-mono text-sm text-gray-700">{r.address.slice(0, 8)}...{r.address.slice(-6)}</span>
                <span className="text-xs px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-md font-medium">{r.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reimbursement Approvals */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Pending Reimbursements</h3>
          <button className="text-xs text-indigo-600 hover:underline" onClick={fetchReimbursements}>Refresh</button>
        </div>
        {reimbMessage && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 mb-3">{reimbMessage}</div>
        )}
        {pendingReimbursements.length === 0 ? (
          <p className="text-gray-400 text-sm">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {pendingReimbursements.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.description}</p>
                  <p className="text-xs text-gray-400 font-mono">{r.employee.slice(0, 10)}... &middot; {r.timestamp}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700"
                    onClick={() => handleReimbursement(r.index, true)}
                  >
                    Approve
                  </button>
                  <button
                    className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600"
                    onClick={() => handleReimbursement(r.index, false)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
