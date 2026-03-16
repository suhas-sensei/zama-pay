"use client";

interface SettingsViewProps {
  payroll: any;
}

export function SettingsView({ payroll }: SettingsViewProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Settings</h2>

      {/* Contract Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Contract Addresses</h3>
        <div className="space-y-3">
          <InfoRow label="Payroll Contract" value={payroll.payrollAddress} />
          <InfoRow label="Token Contract" value={payroll.tokenAddress} />
          <InfoRow label="Token" value={`${payroll.tokenSymbol ?? "..."} (${payroll.tokenName ?? "..."})`} mono={false} />
          <InfoRow
            label="Total Supply"
            value={`${payroll.totalSupply > 0 ? (payroll.totalSupply / 1_000_000).toFixed(2) : "0"} cUSDT`}
            mono={false}
          />
          <InfoRow label="Employer" value={payroll.employer} />
        </div>
      </div>

      {/* Network Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Network</h3>
        <div className="space-y-3">
          <InfoRow label="Chain ID" value={String(payroll.chainId ?? "...")} mono={false} />
          <InfoRow label="Connected Account" value={payroll.accounts?.[0] ?? "Not connected"} />
          <InfoRow label="FHE Mode" value={payroll.chainId === 31337 ? "Mock (Local Hardhat)" : "Production"} mono={false} />
        </div>
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
