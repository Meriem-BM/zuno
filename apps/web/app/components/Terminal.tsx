export function Terminal() {
  return (
    <div className="font-jetbrains text-[12.5px] leading-[1.7]">
      <div className="sheen overflow-hidden rounded-md border border-line bg-[#08080a] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
        {/* title bar */}
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="block h-[9px] w-[9px] rounded-full bg-[#1f1e22]" />
            <span className="block h-[9px] w-[9px] rounded-full bg-[#1f1e22]" />
            <span className="block h-[9px] w-[9px] rounded-full bg-[#1f1e22]" />
          </div>
          <span className="text-[10.5px] text-muted">~/zuno-wallet · operator</span>
          <span className="w-12" />
        </div>

        {/* body */}
        <div className="cascade px-6 py-5 text-fg-2">
          <div className="text-fg">
            <span className="text-pink">$</span> recommend rebalance{" "}
            <span className="text-pink">pos_4f2a3b</span>
          </div>

          <div className="mt-4 space-y-1 text-muted">
            <Line label="watcher" value="reading position pos_4f2a3b" />
            <Line label="planner" value="proposing 2 candidates" />
            <Line label="risk" value="critiquing, vetoing tighten" />
          </div>

          <div className="my-5 h-px bg-line" />

          <div className="space-y-1.5">
            <Row k="position" v="USDC / ETH 0.05%" />
            <Row
              k="range"
              v="1,820.40 → 2,040.10"
              suffix={<span className="text-pink-deep">out of range</span>}
            />
            <Row k="current" v="2,073.62" />
          </div>

          <div className="my-5 h-px bg-line" />

          <div className="space-y-1.5">
            <Row
              k="recommended"
              v="1,940 → 2,210"
              suffix={<span className="text-pink">widen + shift</span>}
            />
            <Row
              k="rejected"
              v="1,995 → 2,150"
              suffix={<span className="text-muted">too tight</span>}
            />
            <Row k="reason" v="< 36h buffer at recent volatility" valueClass="text-fg-2" />
            <Row k="signer" v="zuno wallet · turnkey" valueClass="text-fg-2" />
          </div>

          <div className="my-5 h-px bg-line" />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-muted">verdict</span>
            <span className="text-pink">approve_with_caution</span>
            <span className="text-faint">·</span>
            <span className="text-muted">confidence</span>
            <span className="text-fg">0.82</span>
            <span className="text-faint">·</span>
            <span className="text-muted">approval</span>
            <span className="text-fg">human</span>
          </div>

          <div className="mt-6 text-fg">
            <span className="text-pink">$</span>
            <span className="ml-2 inline-block h-[12px] w-[7px] translate-y-px bg-fg blink" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-pink">◇</span>
      <span className="w-[68px] text-muted">{label}</span>
      <span className="text-fg-2">{value}</span>
    </div>
  );
}

function Row({
  k,
  v,
  suffix,
  valueClass,
}: {
  k: string;
  v: string;
  suffix?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4">
      <span className="w-[110px] text-muted">{k}</span>
      <span className={valueClass ?? "text-fg"}>{v}</span>
      {suffix ? <span className="ml-2">{suffix}</span> : null}
    </div>
  );
}
