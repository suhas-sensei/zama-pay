"use client";

interface EmployeeSettingsViewProps {
  payroll: any;
}

export function EmployeeSettingsView({ payroll }: EmployeeSettingsViewProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Settings</h2>

      {/* Account Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Account Information</h3>
        <div className="space-y-3">
          <InfoRow label="Wallet Address" value={payroll.accounts?.[0]} />
          <InfoRow label="Chain ID" value={String(payroll.chainId ?? "...")} mono={false} />
          <InfoRow label="FHE Mode" value={payroll.chainId === 31337 ? "Mock (Local Hardhat)" : "Production"} mono={false} />
          <InfoRow label="Employee Status" value={payroll.isEmployeeUser ? "Active" : "Not Registered"} mono={false} />
        </div>
      </div>

      {/* Contract Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Contract Addresses</h3>
        <div className="space-y-3">
          <InfoRow label="Payroll Contract" value={payroll.payrollAddress} />
          <InfoRow label="Token Contract" value={payroll.tokenAddress} />
          <InfoRow label="Token" value={`${payroll.tokenSymbol ?? "..."} (${payroll.tokenName ?? "..."})`} mono={false} />
          <InfoRow label="Employer" value={payroll.employer} />
        </div>
      </div>

      {/* Privacy */}
      <div className="bg-blue-50 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <h3 className="text-sm font-semibold text-gray-900">Privacy Notice</h3>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Your salary and balance data are encrypted end-to-end using Fully Homomorphic Encryption (FHE) via the Zama Protocol.
          Only you and the employer contract can decrypt this data. No third party — including blockchain validators — can access your compensation information.
          Salary attestations allow you to selectively prove facts about your income without revealing the exact amount.
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = true }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs text-gray-900 ${mono ? "font-mono" : ""} max-w-[60%] truncate`}>
        {value ?? "..."}
      </span>
    </div>
  );
}
