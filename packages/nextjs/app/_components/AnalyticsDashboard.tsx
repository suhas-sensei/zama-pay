"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

interface AnalyticsDashboardProps {
  payroll: any;
  analyticsAddress?: string;
  analyticsAbi?: any[];
}

export const AnalyticsDashboard = ({ payroll, analyticsAddress, analyticsAbi }: AnalyticsDashboardProps) => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchData = useCallback(async () => {
    if (!analyticsAddress || !analyticsAbi) return;
    try {
      const provider = payroll.ethersReadonlyProvider;
      if (!provider) return;
      const contract = new ethers.Contract(analyticsAddress, analyticsAbi, provider);

      const deptIds = await contract.getAllDepartments();
      const depts = [];
      for (const id of deptIds) {
        const stats = await contract.getDepartmentStats(id);
        depts.push({
          id: id,
          name: id.slice(0, 10),
          headcount: Number(stats[0]),
          totalSalaryHandle: stats[1],
        });
      }
      setDepartments(depts);

      const snapshotCount = await contract.getSnapshotCount();
      const snaps = [];
      for (let i = 0; i < Math.min(Number(snapshotCount), 10); i++) {
        const s = await contract.getSnapshot(i);
        snaps.push({
          timestamp: new Date(Number(s[0]) * 1000).toLocaleString(),
          employeeCount: Number(s[1]),
          payrollId: Number(s[3]),
        });
      }
      setSnapshots(snaps);
    } catch {}
  }, [analyticsAddress, analyticsAbi]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createDepartment = async () => {
    if (!analyticsAddress || !analyticsAbi || !newDeptName) return;
    setIsLoading(true);
    setMessage("Creating department...");
    try {
      if (!payroll.ethersSigner) return;
      const contract = new ethers.Contract(analyticsAddress, analyticsAbi, payroll.ethersSigner);
      const tx = await contract.createDepartment(newDeptName);
      await tx.wait();
      setMessage(`Department "${newDeptName}" created!`);
      setNewDeptName("");
      fetchData();
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 p-6">
      <h3 className="text-lg font-bold mb-2 text-gray-900">Payroll Analytics</h3>
      <p className="text-gray-500 text-sm mb-4">
        Encrypted aggregate statistics. Department totals are computed on encrypted data — individual salaries are never exposed.
      </p>

      {message && (
        <div className="bg-gray-100 border border-gray-300 px-3 py-2 text-sm text-gray-700 mb-4">{message}</div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-50 border border-gray-200 p-4">
          <p className="text-gray-500 text-xs">Departments</p>
          <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 p-4">
          <p className="text-gray-500 text-xs">Employees</p>
          <p className="text-2xl font-bold text-gray-900">{payroll.employeeCount}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 p-4">
          <p className="text-gray-500 text-xs">Payroll Snapshots</p>
          <p className="text-2xl font-bold text-gray-900">{snapshots.length}</p>
        </div>
      </div>

      {/* Create Department */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Department name (e.g. Engineering)"
          className="flex-1 border border-gray-300 p-3 text-sm text-gray-900 bg-white"
          value={newDeptName}
          onChange={e => setNewDeptName(e.target.value)}
        />
        <button
          className="bg-gray-800 text-white px-6 py-3 font-semibold hover:bg-gray-900 disabled:opacity-50"
          disabled={isLoading || !newDeptName}
          onClick={createDepartment}
        >
          Add Dept
        </button>
      </div>

      {/* Department List */}
      {departments.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-800 mb-2">Departments</h4>
          <div className="space-y-2">
            {departments.map((dept, i) => (
              <div key={i} className="flex items-center justify-between py-3 px-4 bg-gray-50 border border-gray-200">
                <div>
                  <span className="font-medium text-gray-900">{dept.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-600">{dept.headcount} employees</span>
                  <span className="ml-3 text-xs bg-gray-200 text-gray-700 px-2 py-0.5">Budget: Encrypted</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payroll History */}
      {snapshots.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Payroll History</h4>
          <div className="space-y-1">
            {snapshots.map((s, i) => (
              <div key={i} className="flex justify-between py-2 px-4 bg-gray-50 border border-gray-200 text-sm">
                <span className="text-gray-900">Run #{s.payrollId}</span>
                <span className="text-gray-600">{s.employeeCount} employees</span>
                <span className="text-gray-500">{s.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
