"use client";

import { useState, useMemo } from "react";
import { ethers } from "ethers";
import { useFHEDecrypt, useInMemoryStorage } from "@fhevm-sdk";
import { useReadContracts } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/helper";
import { useWagmiEthers } from "~~/hooks/wagmi/useWagmiEthers";
import { notification } from "~~/utils/helper/notification";
import type { AllowedChainIds } from "~~/utils/helper/networks";

interface EmployeesViewProps {
  payroll: any;
  fhevmInstance?: any;
  initialMockChains?: Readonly<Record<number, string>>;
  accessControlAddress?: string;
  accessControlAbi?: any[];
  employeeSalaryDecrypt?: any;
  decryptedSalaryMap?: Record<string, number>;
}

export function EmployeesView({ payroll, fhevmInstance, initialMockChains, accessControlAddress, accessControlAbi, employeeSalaryDecrypt, decryptedSalaryMap }: EmployeesViewProps) {
  const [newAddress, setNewAddress] = useState("");
  const [newSalary, setNewSalary] = useState("");
  const [updateAddress, setUpdateAddress] = useState("");
  const [updateSalary, setUpdateSalary] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [roleAddress, setRoleAddress] = useState("");
  const [selectedRole, setSelectedRole] = useState(1);
  const [roleLoading, setRoleLoading] = useState(false);

  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const { chainId, ethersSigner } = useWagmiEthers(initialMockChains);

  const allowedChainId = typeof payroll.chainId === "number" ? (payroll.chainId as AllowedChainIds) : undefined;
  const { data: payrollContract } = useDeployedContractInfo({
    contractName: "ConfidentialPayroll",
    chainId: allowedChainId,
  });

  // Batch fetch all employee salary handles
  const salaryHandleContracts = useMemo(() => {
    if (!payrollContract?.address || !payrollContract?.abi || payroll.employeeAddresses.length === 0) return [];
    return payroll.employeeAddresses.map((addr: string) => ({
      address: payrollContract.address as `0x${string}`,
      abi: payrollContract.abi as any,
      functionName: "getEmployeeSalary",
      args: [addr],
    }));
  }, [payrollContract, payroll.employeeAddresses]);

  const salaryHandlesResult = useReadContracts({
    contracts: salaryHandleContracts,
    query: { enabled: salaryHandleContracts.length > 0 },
  });

  // Build decrypt requests from fetched handles
  const decryptRequests = useMemo(() => {
    if (!salaryHandlesResult.data || !payrollContract?.address) return undefined;
    const reqs: { handle: string; contractAddress: `0x${string}` }[] = [];
    for (const result of salaryHandlesResult.data) {
      const handle = result.result as string | undefined;
      if (handle && handle !== ethers.ZeroHash) {
        reqs.push({ handle, contractAddress: payrollContract.address as `0x${string}` });
      }
    }
    return reqs.length > 0 ? reqs : undefined;
  }, [salaryHandlesResult.data, payrollContract]);

  // Batch decrypt all salary handles
  const salaryDecrypt = useFHEDecrypt({
    instance: fhevmInstance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests: decryptRequests,
  });

  // Use shared decrypt if available, fall back to local
  const activeDecrypt = employeeSalaryDecrypt ?? salaryDecrypt;
  const activeMap = decryptedSalaryMap ?? {};

  const getSalary = (addr: string, index: number): { value: string } => {
    // Check shared map first
    if (activeMap[addr] !== undefined) {
      return { value: `${activeMap[addr].toFixed(2)} cUSDT` };
    }
    // Check local decrypt
    if (salaryHandlesResult.data?.[index]) {
      const handle = salaryHandlesResult.data[index].result as string | undefined;
      if (handle && handle !== ethers.ZeroHash && salaryDecrypt.results[handle] !== undefined) {
        return { value: `${(Number(salaryDecrypt.results[handle]) / 1_000_000).toFixed(2)} cUSDT` };
      }
    }
    return { value: "Encrypted" };
  };

  const hasAnyEncrypted = useMemo(() => {
    if (Object.keys(activeMap).length >= payroll.employeeAddresses.length && payroll.employeeAddresses.length > 0) return false;
    if (!salaryHandlesResult.data) return payroll.employeeAddresses.length > 0;
    return salaryHandlesResult.data.some((r: any) => {
      const handle = r.result as string | undefined;
      return handle && handle !== ethers.ZeroHash && !salaryDecrypt.results[handle];
    });
  }, [salaryHandlesResult.data, salaryDecrypt.results, activeMap, payroll.employeeAddresses]);

  const getRoleContract = () => {
    if (!accessControlAddress || !accessControlAbi || !payroll.ethersSigner) return null;
    return new ethers.Contract(accessControlAddress, accessControlAbi, payroll.ethersSigner);
  };

  const grantRole = async () => {
    if (!roleAddress) return;
    setRoleLoading(true);
    try {
      const contract = getRoleContract();
      if (!contract) return;
      const tx = await contract.grantRole(ethers.getAddress(roleAddress), selectedRole);
      await tx.wait();
      const roleName = ["", "HR_ADMIN", "FINANCE", "AUDITOR"][selectedRole];
      notification.success(`${roleName} granted to ${roleAddress.slice(0, 8)}...`);
      setRoleAddress("");
    } catch (e) {
      notification.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRoleLoading(false);
    }
  };

  const revokeRole = async () => {
    if (!roleAddress) return;
    setRoleLoading(true);
    try {
      const contract = getRoleContract();
      if (!contract) return;
      const tx = await contract.revokeRole(ethers.getAddress(roleAddress));
      await tx.wait();
      notification.success(`Role revoked from ${roleAddress.slice(0, 8)}...`);
      setRoleAddress("");
    } catch (e) {
      notification.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRoleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Employees</h2>
        <div className="flex gap-2">
          {hasAnyEncrypted && (activeDecrypt.canDecrypt || salaryDecrypt.canDecrypt) && (
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              onClick={() => activeDecrypt.canDecrypt ? activeDecrypt.decrypt() : salaryDecrypt.decrypt()}
              disabled={activeDecrypt.isDecrypting || salaryDecrypt.isDecrypting}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              {(activeDecrypt.isDecrypting || salaryDecrypt.isDecrypting) ? "Decrypting..." : "Decrypt All Salaries"}
            </button>
          )}
          <button
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Employee
          </button>
        </div>
      </div>

      {/* Add Employee Form */}
      {showAddForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">New Employee</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Wallet address (0x...)"
              className="border border-gray-300 rounded-lg p-3 text-sm font-mono text-gray-900 bg-white"
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
            />
            <input
              type="number"
              placeholder="Monthly salary (cUSDT)"
              className="border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white"
              value={newSalary}
              onChange={e => setNewSalary(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              disabled={payroll.isProcessing || !newAddress || !newSalary}
              onClick={() => {
                const salaryInUnits = Math.round(parseFloat(newSalary) * 1_000_000);
                payroll.addEmployee(newAddress, salaryInUnits);
                setNewAddress("");
                setNewSalary("");
                setShowAddForm(false);
              }}
            >
              {payroll.isProcessing ? "Processing..." : "Add Employee"}
            </button>
            <button
              className="text-gray-600 px-4 py-2 text-sm hover:text-gray-900"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Update Salary Form */}
      {showUpdateForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Update Salary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Employee address (0x...)"
              className="border border-gray-300 rounded-lg p-3 text-sm font-mono text-gray-900 bg-white"
              value={updateAddress}
              onChange={e => setUpdateAddress(e.target.value)}
            />
            <input
              type="number"
              placeholder="New salary (cUSDT)"
              className="border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white"
              value={updateSalary}
              onChange={e => setUpdateSalary(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              disabled={payroll.isProcessing || !updateAddress || !updateSalary}
              onClick={() => {
                const salaryInUnits = Math.round(parseFloat(updateSalary) * 1_000_000);
                payroll.updateSalary(updateAddress, salaryInUnits);
                setUpdateAddress("");
                setUpdateSalary("");
                setShowUpdateForm(false);
              }}
            >
              {payroll.isProcessing ? "Processing..." : "Update Salary"}
            </button>
            <button className="text-gray-600 px-4 py-2 text-sm" onClick={() => setShowUpdateForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-5 py-3 font-medium">Wallet Address</th>
              <th className="px-5 py-3 font-medium">Salary</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payroll.employeeAddresses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                  No employees added yet. Click &quot;Add Employee&quot; to get started.
                </td>
              </tr>
            ) : (
              payroll.employeeAddresses.map((addr: string, i: number) => {
                const salary = getSalary(addr, i);
                return (
                  <tr key={addr} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-gray-400">{i + 1}</td>
                    <td className="px-5 py-4 font-mono text-gray-900">
                      {addr.slice(0, 6)}...{addr.slice(-4)}
                    </td>
                    <td className="px-5 py-4">
                      {salary.value === "Encrypted" ? (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium">
                          Encrypted
                        </span>
                      ) : salary.value === "Loading..." ? (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">Loading...</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                          {salary.value}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-green-700 text-xs font-medium">Active</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="text-gray-400 hover:text-amber-600 mr-3"
                        title="Update Salary"
                        onClick={() => { setUpdateAddress(addr); setShowUpdateForm(true); }}
                      >
                        <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        className="text-gray-400 hover:text-red-600"
                        title="Remove"
                        onClick={() => payroll.removeEmployee(addr)}
                        disabled={payroll.isProcessing}
                      >
                        <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Role Management */}
      {accessControlAddress && accessControlAbi && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Role Management</h3>
          <p className="text-xs text-gray-400 !mb-4">Grant or revoke access roles for team members</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              className="border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white"
              value={selectedRole}
              onChange={e => setSelectedRole(Number(e.target.value))}
            >
              <option value={1}>HR Admin</option>
              <option value={2}>Finance / CFO</option>
              <option value={3}>Auditor</option>
            </select>
            <input
              type="text"
              placeholder="Address (0x...)"
              className="border border-gray-300 rounded-lg p-3 text-sm font-mono text-gray-900 bg-white"
              value={roleAddress}
              onChange={e => setRoleAddress(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                disabled={!roleAddress || roleLoading}
                onClick={grantRole}
              >
                {roleLoading ? "..." : "Grant"}
              </button>
              <button
                className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                disabled={!roleAddress || roleLoading}
                onClick={revokeRole}
              >
                Revoke
              </button>
            </div>
          </div>
          <RoleInfoTooltip />
        </div>
      )}
    </div>
  );
}

function RoleInfoTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Show more
      </button>
      {open && (
        <div className="absolute bottom-8 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-80 z-10">
          <div className="space-y-2.5 text-xs text-gray-600">
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1 flex-shrink-0" />
              <p className="!m-0"><span className="font-semibold text-gray-900">HR Admin</span> — Can add/remove employees but cannot see salary amounts</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
              <p className="!m-0"><span className="font-semibold text-gray-900">Finance</span> — Can view totals and execute payroll</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 mt-1 flex-shrink-0" />
              <p className="!m-0"><span className="font-semibold text-gray-900">Auditor</span> — Can verify payroll execution without seeing individual amounts</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
