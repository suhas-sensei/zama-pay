"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

interface RoleManagementProps {
  payroll: any;
  accessControlAddress?: string;
  accessControlAbi?: any[];
}

export const RoleManagement = ({ payroll, accessControlAddress, accessControlAbi }: RoleManagementProps) => {
  const [grantAddress, setGrantAddress] = useState("");
  const [selectedRole, setSelectedRole] = useState("1");
  const [roleHolders, setRoleHolders] = useState<{address: string; role: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const roleNames: Record<string, string> = {
    "0": "None",
    "1": "HR Admin",
    "2": "Finance",
    "3": "Auditor",
  };

  const getReadContract = useCallback(() => {
    if (!accessControlAddress || !accessControlAbi || !payroll.ethersReadonlyProvider) return null;
    return new ethers.Contract(accessControlAddress, accessControlAbi, payroll.ethersReadonlyProvider);
  }, [accessControlAddress, accessControlAbi, payroll.ethersReadonlyProvider]);

  const getWriteContract = useCallback(() => {
    if (!accessControlAddress || !accessControlAbi || !payroll.ethersSigner) return null;
    return new ethers.Contract(accessControlAddress, accessControlAbi, payroll.ethersSigner);
  }, [accessControlAddress, accessControlAbi, payroll.ethersSigner]);

  const fetchRoles = useCallback(async () => {
    const contract = getReadContract();
    if (!contract) return;
    try {
      const [accounts, roles] = await contract.getAllRoleHolders();
      const holders = accounts.map((addr: string, i: number) => ({
        address: addr,
        role: roleNames[roles[i].toString()] || "Unknown",
      }));
      setRoleHolders(holders);
    } catch {}
  }, [getReadContract]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const grantRole = async () => {
    const contract = getWriteContract();
    if (!contract || !grantAddress) return;
    setIsLoading(true);
    setMessage("Granting role...");
    try {
      const tx = await contract.grantRole(grantAddress, parseInt(selectedRole));
      await tx.wait();
      setMessage("Role granted!");
      setGrantAddress("");
      fetchRoles();
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const revokeRole = async (addr: string) => {
    const contract = getWriteContract();
    if (!contract) return;
    setIsLoading(true);
    setMessage("Revoking role...");
    try {
      const tx = await contract.revokeRole(addr);
      await tx.wait();
      setMessage("Role revoked!");
      fetchRoles();
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 p-6">
      <h3 className="text-lg font-bold mb-4 text-gray-900">Role Management</h3>
      <p className="text-gray-500 text-sm mb-4">
        Assign roles to delegate payroll operations. HR can manage employees, Finance can execute payroll, Auditors can view logs.
      </p>

      {message && (
        <div className="bg-gray-100 border border-gray-300 px-3 py-2 text-sm text-gray-700 mb-4">{message}</div>
      )}

      <div className="space-y-3 mb-6">
        <input
          type="text"
          placeholder="Address (0x...)"
          className="w-full border border-gray-300 p-3 text-sm font-mono text-gray-900 bg-white"
          value={grantAddress}
          onChange={e => setGrantAddress(e.target.value)}
        />
        <select
          className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
          value={selectedRole}
          onChange={e => setSelectedRole(e.target.value)}
        >
          <option value="1">HR Admin — manage employees</option>
          <option value="2">Finance — execute payroll, mint tokens</option>
          <option value="3">Auditor — view logs only</option>
        </select>
        <button
          className="w-full bg-indigo-600 text-white py-3 font-semibold hover:bg-indigo-700 disabled:opacity-50"
          disabled={isLoading || !grantAddress}
          onClick={grantRole}
        >
          {isLoading ? "Processing..." : "Grant Role"}
        </button>
      </div>

      <h4 className="font-semibold text-gray-800 mb-2">Current Role Holders</h4>
      {roleHolders.length === 0 ? (
        <p className="text-gray-500 text-sm">No roles assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {roleHolders.map((holder, i) => (
            <div key={i} className="flex items-center justify-between py-3 px-4 bg-gray-50 border border-gray-200">
              <div>
                <span className="font-mono text-sm text-gray-900">{holder.address.slice(0, 10)}...{holder.address.slice(-6)}</span>
                <span className="ml-3 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5">{holder.role}</span>
              </div>
              <button
                className="text-red-600 text-sm hover:underline disabled:opacity-50"
                disabled={isLoading}
                onClick={() => revokeRole(holder.address)}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
