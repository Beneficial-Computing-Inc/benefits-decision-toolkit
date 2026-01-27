/**
 * AnnotationBadge component.
 * Displays annotation information with expandable details.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, FileText, Info } from 'lucide-react';
import type { Annotation } from '../lib/annotations';

interface AnnotationBadgeProps {
  annotation: Annotation | null;
  variant?: 'inline' | 'block';
  showPlainLanguage?: boolean;
}

export function AnnotationBadge({
  annotation,
  variant = 'inline',
  showPlainLanguage = false,
}: AnnotationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (!annotation) {
    return null;
  }

  if (variant === 'inline') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:text-blue-800"
        onClick={() => setExpanded(!expanded)}
        title={annotation.plainLanguageSummary}
      >
        <Info className="w-3 h-3" />
        <span className="underline decoration-dotted">Annotated</span>
      </span>
    );
  }

  return (
    <div className="border border-blue-200 rounded-md bg-blue-50/50 overflow-hidden">
      <button
        className="w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-blue-100/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-blue-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-blue-600" />
        )}
        <BookOpen className="w-4 h-4 text-blue-600" />
        <span className="font-medium text-blue-800">Annotation</span>
        <span className="text-xs text-blue-600 ml-auto">
          {annotation.source === 'llm' ? 'AI Generated' : annotation.source}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 text-sm">
          {/* Technical explanation */}
          <div>
            <h4 className="font-medium text-gray-700 mb-1">Explanation</h4>
            <p className="text-gray-600">{annotation.explanation}</p>
          </div>

          {/* Plain language summary */}
          {showPlainLanguage && annotation.plainLanguageSummary && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Plain Language</h4>
              <p className="text-gray-600 italic">{annotation.plainLanguageSummary}</p>
            </div>
          )}

          {/* POMS references */}
          {annotation.pomsReferences.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                POMS References
              </h4>
              <div className="flex flex-wrap gap-2">
                {annotation.pomsReferences.map((ref) => (
                  <a
                    key={ref}
                    href={`https://secure.ssa.gov/poms.nsf/lnx/0${ref.replace(/\s/g, '').replace('SI', '5')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    {ref}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-400 pt-2 border-t border-blue-200">
            Last updated: {new Date(annotation.updatedAt).toLocaleDateString()}
            {annotation.model && ` • Model: ${annotation.model}`}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnotationBadge;
