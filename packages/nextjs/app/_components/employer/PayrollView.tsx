"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";

interface PayrollViewProps {
  payroll: any;
  schedulerAddress?: string;
  schedulerAbi?: any[];
}

export function PayrollView({ payroll, schedulerAddress, schedulerAbi }: PayrollViewProps) {
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [frequency, setFrequency] = useState(2); // Monthly
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [showApprovalPopup, setShowApprovalPopup] = useState(false);
  const prevProcessing = useRef(payroll.isProcessing);
  const [currentSchedule, setCurrentSchedule] = useState<any>(null);

  const fetchSchedule = useCallback(async () => {
    if (!schedulerAddress || !schedulerAbi || !payroll.ethersReadonlyProvider) return;
    try {
      const contract = new ethers.Contract(schedulerAddress, schedulerAbi, payroll.ethersReadonlyProvider);
      const schedule = await contract.getSchedule();
      setCurrentSchedule({
        isActive: schedule.isActive ?? schedule[0],
        frequency: Number(schedule.frequency ?? schedule[1]),
        nextExecution: Number(schedule.nextExecution ?? schedule[2]),
        lastExecution: Number(schedule.lastExecution ?? schedule[3]),
      });
    } catch {}
  }, [schedulerAddress, schedulerAbi, payroll.ethersReadonlyProvider]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  // Show approval popup after minting completes if not approved
  useEffect(() => {
    if (prevProcessing.current && !payroll.isProcessing && payroll.message?.includes("Minted") && !payroll.isPayrollApproved) {
      setShowApprovalPopup(true);
    }
    prevProcessing.current = payroll.isProcessing;
  }, [payroll.isProcessing, payroll.message, payroll.isPayrollApproved]);

  const createSchedule = async () => {
    if (!schedulerAddress || !schedulerAbi || !payroll.ethersSigner) return;
    setScheduleMessage("Creating schedule...");
    try {
      const contract = new ethers.Contract(schedulerAddress, schedulerAbi, payroll.ethersSigner);
      const firstPayDate = Math.floor(Date.now() / 1000); // now
      const tx = await contract.createSchedule(frequency, firstPayDate);
      await tx.wait();
      setScheduleMessage("Schedule created!");
      fetchSchedule();
    } catch (e) {
      setScheduleMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const triggerPayroll = async () => {
    if (!schedulerAddress || !schedulerAbi || !payroll.ethersSigner) return;
    setScheduleMessage("Triggering payroll...");
    try {
      const contract = new ethers.Contract(schedulerAddress, schedulerAbi, payroll.ethersSigner);
      const tx = await contract.triggerPayroll();
      await tx.wait();
      setScheduleMessage("Payroll triggered via scheduler!");
      fetchSchedule();
      payroll.refetchAll();
    } catch (e) {
      setScheduleMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const freqLabels = ["Weekly", "Biweekly", "Monthly"];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Payroll</h2>

      {/* Approval Popup Modal */}
      {showApprovalPopup && !payroll.isPayrollApproved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center !mb-2">Approve Payroll Contract</h3>
            <p className="text-sm text-gray-500 text-center !mb-6">
              Tokens minted successfully! Now approve the payroll contract to transfer tokens on your behalf so you can execute payroll.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                disabled={payroll.isProcessing}
                onClick={async () => {
                  await payroll.approvePayrollOperator();
                  setShowApprovalPopup(false);
                }}
              >
                {payroll.isProcessing ? "Approving..." : "Approve"}
              </button>
              <button
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                onClick={() => setShowApprovalPopup(false)}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execute Payroll */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Execute Payroll</h3>
            <p className="text-xs text-gray-400">Transfer encrypted salaries to all {payroll.employeeCount} employees</p>
          </div>
          {payroll.lastPayrollTimestamp > 0 && (
            <span className="text-xs text-gray-400">
              Last run: {new Date(payroll.lastPayrollTimestamp * 1000).toLocaleDateString()}
            </span>
          )}
        </div>
        <button
          className="w-full bg-green-600 text-white py-3.5 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          disabled={payroll.isProcessing || payroll.employeeCount === 0 || !payroll.isPayrollApproved}
          onClick={payroll.executePayroll}
        >
          {payroll.isProcessing ? "Processing..." : `Execute Payroll (${payroll.employeeCount} employees)`}
        </button>
      </div>

      {/* Mint Tokens */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Mint cUSDT</h3>
        <p className="text-xs text-gray-400 mb-4">Mint confidential tokens to fund payroll</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Recipient address (0x...)"
            className="border border-gray-300 rounded-lg p-3 text-sm font-mono text-gray-900 bg-white"
            value={mintTo}
            onChange={e => setMintTo(e.target.value)}
          />
          <input
            type="number"
            placeholder="Amount (e.g. 100000)"
            className="border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white"
            value={mintAmount}
            onChange={e => setMintAmount(e.target.value)}
          />
        </div>
        <button
          className="mt-3 bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          disabled={payroll.isProcessing || !mintTo || !mintAmount}
          onClick={() => {
            const amountInUnits = Math.round(parseFloat(mintAmount) * 1_000_000);
            payroll.mintTokens(mintTo, amountInUnits);
            setMintTo("");
            setMintAmount("");
          }}
        >
          {payroll.isProcessing ? "Minting..." : "Mint Tokens"}
        </button>
      </div>

      {/* Scheduler */}
      {schedulerAddress && schedulerAbi && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Payroll Scheduler</h3>
          <p className="text-xs text-gray-400 mb-4">Automate recurring payroll execution</p>

          {scheduleMessage && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 mb-4">
              {scheduleMessage}
            </div>
          )}

          {currentSchedule?.isActive ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-800">Schedule Active</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
                <div>
                  <p className="text-gray-400">Frequency</p>
                  <p className="font-medium text-gray-900">{freqLabels[currentSchedule.frequency] ?? "Unknown"}</p>
                </div>
                <div>
                  <p className="text-gray-400">Next Execution</p>
                  <p className="font-medium text-gray-900">
                    {currentSchedule.nextExecution > 0
                      ? new Date(currentSchedule.nextExecution * 1000).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Last Execution</p>
                  <p className="font-medium text-gray-900">
                    {currentSchedule.lastExecution > 0
                      ? new Date(currentSchedule.lastExecution * 1000).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>
              </div>
              <button
                className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                onClick={triggerPayroll}
              >
                Trigger Now
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <select
                className="border border-gray-300 rounded-lg p-2.5 text-sm text-gray-900 bg-white"
                value={frequency}
                onChange={e => setFrequency(Number(e.target.value))}
              >
                <option value={0}>Weekly</option>
                <option value={1}>Biweekly</option>
                <option value={2}>Monthly</option>
              </select>
              <button
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
                onClick={createSchedule}
              >
                Create Schedule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
