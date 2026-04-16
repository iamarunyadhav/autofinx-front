import { Bot, BriefcaseBusiness, CandlestickChart, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const items = [
  { label: "Trading", path: "/trading", icon: CandlestickChart },
  { label: "Deals", path: "/deals", icon: BriefcaseBusiness },
  { label: "Robot", path: "/robot-trading", icon: Bot },
  { label: "Account", path: "/wallet", icon: Wallet },
];

export function MobileTradeNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800/80 bg-slate-950/95 px-2 pb-safe backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-1 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-2xl text-[11px] font-medium transition",
                active ? "bg-blue-500/15 text-blue-300" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
              )}
            >
              <Icon className="mb-1 h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
