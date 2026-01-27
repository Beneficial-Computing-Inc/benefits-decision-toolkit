/**
 * BkmTooltip component.
 * Displays a tooltip with BKM function description on hover.
 */

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface BkmTooltipProps {
  /** BKM function name (e.g., "Age.as of date") */
  bkmName: string;
  /** Description of what the BKM does */
  description: string | null;
  /** Parameters if available */
  parameters?: string[];
  /** Children to wrap (the BKM call text) */
  children: React.ReactNode;
}

export function BkmTooltip({
  bkmName,
  description,
  parameters,
  children,
}: BkmTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Adjust tooltip position based on available space
  useEffect(() => {
    if (isOpen && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // If tooltip would go above viewport, show below
      if (triggerRect.top - tooltipRect.height < 10) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  }, [isOpen]);

  return (
    <span className="relative inline">
      <span
        ref={triggerRef}
        className="text-blue-600 underline decoration-dotted cursor-help hover:text-blue-800"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        tabIndex={0}
        role="button"
        aria-describedby={isOpen ? `bkm-tooltip-${bkmName.replace(/\s/g, '-')}` : undefined}
      >
        {children}
      </span>

      {isOpen && (
        <div
          ref={tooltipRef}
          id={`bkm-tooltip-${bkmName.replace(/\s/g, '-')}`}
          role="tooltip"
          className={`absolute z-50 w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-lg text-sm ${
            position === 'top'
              ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
              : 'top-full mt-2 left-1/2 -translate-x-1/2'
          }`}
        >
          {/* Arrow */}
          <div
            className={`absolute w-3 h-3 bg-white border-gray-200 rotate-45 ${
              position === 'top'
                ? 'bottom-[-6px] left-1/2 -translate-x-1/2 border-r border-b'
                : 'top-[-6px] left-1/2 -translate-x-1/2 border-l border-t'
            }`}
          />

          {/* Content */}
          <div className="relative">
            <div className="flex items-start gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span className="font-medium text-gray-800">{bkmName}</span>
            </div>

            {description ? (
              <p className="text-gray-600 text-xs leading-relaxed">
                {description}
              </p>
            ) : (
              <p className="text-gray-400 text-xs italic">
                No description available
              </p>
            )}

            {parameters && parameters.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Parameters: {parameters.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

export default BkmTooltip;
