"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

interface PayrollSchedulerPanelProps {
  payroll: any;
  schedulerAddress?: string;
  schedulerAbi?: any[];
}

export const PayrollSchedulerPanel = ({ payroll, schedulerAddress, schedulerAbi }: PayrollSchedulerPanelProps) => {
  const [frequency, setFrequency] = useState("2"); // MONTHLY
  const [firstPayDate, setFirstPayDate] = useState("");
  const [scheduleInfo, setScheduleInfo] = useState<any>(null);
  const [canExecute, setCanExecute] = useState(false);
  const [executeReason, setExecuteReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const frequencyNames: Record<string, string> = {
    "0": "Weekly",
    "1": "Bi-Weekly",
    "2": "Monthly",
  };

  const fetchSchedule = useCallback(async () => {
    if (!schedulerAddress || !schedulerAbi) return;
    try {
      const provider = payroll.ethersReadonlyProvider;
      if (!provider) return;
      const contract = new ethers.Contract(schedulerAddress, schedulerAbi, provider);
      const info = await contract.getScheduleInfo();
      setScheduleInfo({
        frequency: frequencyNames[info[0].toString()] || "Unknown",
        lastExecuted: Number(info[1]) > 0 ? new Date(Number(info[1]) * 1000).toLocaleString() : "Never",
        nextPayDate: Number(info[2]) > 0 ? new Date(Number(info[2]) * 1000).toLocaleString() : "Not set",
        active: info[3],
        totalExecutions: Number(info[4]),
      });

      const [canExec, reason] = await contract.canExecutePayroll();
      setCanExecute(canExec);
      setExecuteReason(reason);
    } catch {}
  }, [schedulerAddress, schedulerAbi]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const createSchedule = async () => {
    if (!schedulerAddress || !schedulerAbi || !firstPayDate) return;
    setIsLoading(true);
    setMessage("Creating schedule...");
    try {
      if (!payroll.ethersSigner) return;
      const contract = new ethers.Contract(schedulerAddress, schedulerAbi, payroll.ethersSigner);
      const timestamp = Math.floor(new Date(firstPayDate).getTime() / 1000);
      const tx = await contract.createSchedule(parseInt(frequency), timestamp);
      await tx.wait();
      setMessage("Schedule created!");
      fetchSchedule();
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerPayroll = async () => {
    if (!schedulerAddress || !schedulerAbi) return;
    setIsLoading(true);
    setMessage("Triggering payroll...");
    try {
      if (!payroll.ethersSigner) return;
      const contract = new ethers.Contract(schedulerAddress, schedulerAbi, payroll.ethersSigner);
      const tx = await contract.triggerPayroll();
      await tx.wait();
      setMessage("Payroll triggered via scheduler!");
      fetchSchedule();
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSchedule = async (pause: boolean) => {
    if (!schedulerAddress || !schedulerAbi) return;
    setIsLoading(true);
    try {
      if (!payroll.ethersSigner) return;
      const contract = new ethers.Contract(schedulerAddress, schedulerAbi, payroll.ethersSigner);
      const tx = pause ? await contract.pauseSchedule() : await contract.resumeSchedule();
      await tx.wait();
      setMessage(pause ? "Schedule paused" : "Schedule resumed");
      fetchSchedule();
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 p-6">
      <h3 className="text-lg font-bold mb-2 text-gray-900">Payroll Scheduler</h3>
      <p className="text-gray-500 text-sm mb-4">
        Automate payroll with recurring schedules. Compatible with Chainlink Automation.
      </p>

      {message && (
        <div className="bg-gray-100 border border-gray-300 px-3 py-2 text-sm text-gray-700 mb-4">{message}</div>
      )}

      {scheduleInfo && scheduleInfo.active !== undefined ? (
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 border border-gray-200 p-3">
              <p className="text-gray-500 text-xs">Frequency</p>
              <p className="font-bold text-gray-900">{scheduleInfo.frequency}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-3">
              <p className="text-gray-500 text-xs">Status</p>
              <p className="font-bold text-gray-900">{scheduleInfo.active ? "Active" : "Paused"}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-3">
              <p className="text-gray-500 text-xs">Next Pay Date</p>
              <p className="font-bold text-gray-900 text-xs">{scheduleInfo.nextPayDate}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-3">
              <p className="text-gray-500 text-xs">Total Runs</p>
              <p className="font-bold text-gray-900">{scheduleInfo.totalExecutions}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="flex-1 bg-green-600 text-white py-2 font-semibold hover:bg-green-700 disabled:opacity-50"
              disabled={isLoading || !canExecute}
              onClick={triggerPayroll}
            >
              {canExecute ? "Trigger Payroll Now" : executeReason}
            </button>
            <button
              className="px-4 bg-gray-200 text-gray-700 py-2 font-medium hover:bg-gray-300 disabled:opacity-50"
              disabled={isLoading}
              onClick={() => toggleSchedule(scheduleInfo.active)}
            >
              {scheduleInfo.active ? "Pause" : "Resume"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          <select
            className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
            value={frequency}
            onChange={e => setFrequency(e.target.value)}
          >
            <option value="0">Weekly</option>
            <option value="1">Bi-Weekly</option>
            <option value="2">Monthly</option>
          </select>
          <input
            type="datetime-local"
            className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
            value={firstPayDate}
            onChange={e => setFirstPayDate(e.target.value)}
          />
          <button
            className="w-full bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading || !firstPayDate}
            onClick={createSchedule}
          >
            {isLoading ? "Creating..." : "Create Schedule"}
          </button>
        </div>
      )}
    </div>
  );
};
