import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface InfoTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  asChild?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}

export function InfoTooltip({ content, children, asChild = true, side, sideOffset = 4 }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild={asChild}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset} className="bg-slate-800 border-slate-700 text-slate-200 z-[100] shadow-2xl max-w-lg">
        <div className="text-sm">{content}</div>
      </TooltipContent>
    </Tooltip>
  )
}
