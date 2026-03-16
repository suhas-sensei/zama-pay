"use client";

import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useFHEEncryption, toHex } from "@fhevm-sdk";
import { notification } from "~~/utils/helper/notification";

interface ReimbursementsViewProps {
  payroll: any;
  payrollAddress?: string;
  payrollAbi?: any[];
  fhevmInstance?: any;
}

export function ReimbursementsView({ payroll, payrollAddress, payrollAbi, fhevmInstance }: ReimbursementsViewProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [reimbursements, setReimbursements] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const fetchReimbursements = useCallback(async () => {
    if (!payrollAddress || !payrollAbi || !payroll.accounts?.[0] || !payroll.ethersReadonlyProvider) return;
    try {
      const contract = new ethers.Contract(payrollAddress, payrollAbi, payroll.ethersReadonlyProvider);
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
  }, [payrollAddress, payrollAbi, payroll.accounts, payroll.ethersReadonlyProvider]);

  useEffect(() => { fetchReimbursements(); }, [fetchReimbursements]);

  const { encryptWith } = useFHEEncryption({
    instance: fhevmInstance,
    ethersSigner: payroll.ethersSigner as any,
    contractAddress: payrollAddress as `0x${string}` | undefined,
  });

  const submit = async () => {
    if (!payrollAddress || !payrollAbi || !description || !amount || !fhevmInstance) return;
    setIsSubmitting(true);
    setMessage("");
    try {
      const amountUnits = Math.round(parseFloat(amount) * 1_000_000);

      // Encrypt the amount using FHE
      const enc = await encryptWith(builder => {
        builder.add64(amountUnits);
      });
      if (!enc) {
        notification.error("Failed to encrypt amount");
        return;
      }

      const contract = new ethers.Contract(payrollAddress, payrollAbi, payroll.ethersSigner);
      // Contract signature: requestReimbursement(externalEuint64, bytes inputProof, string description)
      const tx = await contract.requestReimbursement(toHex(enc.handles[0]), toHex(enc.inputProof), description);
      await tx.wait();
      notification.success("Reimbursement request submitted!");
      setDescription("");
      setAmount("");
      fetchReimbursements();
    } catch (e) {
      notification.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColor: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-700",
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Reimbursements</h2>

      {/* Submit Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Submit Reimbursement Request</h3>
        <p className="text-xs text-gray-400 mb-4">Request expense reimbursement from your employer</p>

        {message && (
          <div className={`rounded-lg px-4 py-2 text-sm mb-4 ${message.includes("Failed") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {message}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Description (e.g. Conference travel, Office supplies)"
            className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <input
            type="number"
            placeholder="Amount (cUSDT)"
            className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <button
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            disabled={isSubmitting || !description || !amount}
            onClick={submit}
          >
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      </div>

      {/* Past Requests */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Past Requests</h3>
          <button className="text-xs text-indigo-600 hover:underline" onClick={fetchReimbursements}>Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reimbursements.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No reimbursement requests yet</td></tr>
              ) : (
                reimbursements.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-400">{r.index + 1}</td>
                    <td className="py-3 text-gray-900 font-medium">{r.description}</td>
                    <td className="py-3 text-gray-500 text-xs">{r.timestamp}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${statusColor[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {r.status}
                      </span>
                    </td>
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
