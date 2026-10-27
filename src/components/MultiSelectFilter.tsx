import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X, Search, CheckSquare } from 'lucide-react';

interface MultiSelectFilterProps {
  title: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  counts?: Map<string, number> | Record<string, number>;
  totalCount?: number;
  getOptionColorClass?: (option: string) => string;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  title,
  placeholder,
  options,
  selected,
  onChange,
  counts,
  totalCount,
  getOptionColorClass,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 320,
  });

  // Calculate position anchored to the button using fixed viewport coordinates
  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(300, Math.min(360, window.innerWidth - 32));
    
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - dropdownWidth - 16);
    }
    if (left < 16) {
      left = 16;
    }

    // Check if dropdown fits below button; if not and there's space above, position above
    const fitsBelow = rect.bottom + 340 <= window.innerHeight;
    const top = fitsBelow ? rect.bottom + 6 : Math.max(16, rect.top - 340 - 6);

    setMenuPosition({
      top,
      left,
      minWidth: Math.max(rect.width, 280),
    });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleResize = () => updatePosition();
      const handleScroll = () => updatePosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return options.filter(opt => {
      const normOpt = opt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normOpt.includes(term);
    });
  }, [options, searchTerm]);

  const handleToggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(item => item !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const getCount = (opt: string) => {
    if (!counts) return null;
    if (counts instanceof Map) {
      return counts.get(opt) ?? 0;
    }
    return counts[opt] ?? 0;
  };

  const hasSpecificSelection = selected.length > 0 && selected.length < options.length;
  const isAllExplicitlySelected = options.length > 0 && selected.length === options.length;

  // Button label
  let buttonLabel = placeholder;
  if (selected.length === 1) {
    buttonLabel = selected[0];
  } else if (hasSpecificSelection) {
    buttonLabel = `${selected.length} selecionados`;
  } else if (isAllExplicitlySelected) {
    buttonLabel = `Todas (${options.length})`;
  }

  return (
    <div className="relative inline-block text-left">
      {/* Combo Box Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          updatePosition();
        }}
        className={`flex items-center justify-between gap-2 px-3 py-2 text-[13px] rounded-xl border transition-all cursor-pointer whitespace-nowrap select-none shadow-xs ${
          hasSpecificSelection || isAllExplicitlySelected
            ? 'border-blue-500 text-blue-900 font-semibold bg-blue-50/90 ring-2 ring-blue-200'
            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 font-normal'
        }`}
        title={selected.length > 0 ? `${title}: ${selected.join(', ')}` : placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[150px] sm:max-w-[200px]">{buttonLabel}</span>
        
        {hasSpecificSelection && (
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-600 text-white leading-none min-w-[18px]">
            {selected.length}
          </span>
        )}

        <ChevronDown
          size={15}
          className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
        />
      </button>

      {/* Dropdown Menu rendered via Portal into body to eliminate any overflow clipping */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              minWidth: `${menuPosition.minWidth}px`,
              maxWidth: '360px',
              zIndex: 9999,
            }}
            className="w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 px-1 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <CheckSquare size={15} className="text-blue-600" />
                <span className="text-[12px] font-bold text-slate-800 uppercase tracking-wider">
                  {title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                  title="Marcar pisco em todas"
                >
                  Todas
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-slate-500 hover:text-red-600 font-medium hover:underline cursor-pointer"
                  title="Desmarcar todos os piscos"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Search if more than 3 options */}
            {options.length > 3 && (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Options List with Checkboxes (Piscos) */}
            <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-0.5" role="listbox">
              {/* Option "(Todas as Opções)" */}
              {!searchTerm && (
                <div
                  onClick={handleClear}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors select-none border ${
                    selected.length === 0
                      ? 'bg-blue-50/90 border-blue-200 text-blue-900 font-semibold'
                      : 'bg-slate-50/50 border-transparent text-slate-600 hover:bg-slate-100/70'
                  }`}
                  role="option"
                  aria-selected={selected.length === 0}
                >
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center transition-colors border ${
                        selected.length === 0
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {selected.length === 0 && <Check size={12} className="stroke-[3]" />}
                    </div>
                    <span className="truncate">
                      (Todas as opções)
                    </span>
                  </div>
                  {totalCount !== undefined && (
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500">
                      {totalCount}
                    </span>
                  )}
                </div>
              )}

              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  Nenhuma opção encontrada
                </div>
              ) : (
                filteredOptions.map(opt => {
                  const isSelected = selected.includes(opt);
                  const count = getCount(opt);

                  return (
                    <div
                      key={opt}
                      onClick={() => handleToggle(opt)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors select-none ${
                        isSelected
                          ? 'bg-blue-50/80 text-blue-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="flex items-center gap-2.5 truncate mr-2">
                        {/* Pisco (Checkbox com visto) */}
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center transition-colors border shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                              : 'border-slate-300 bg-white hover:border-blue-400'
                          }`}
                        >
                          {isSelected && <Check size={12} className="stroke-[3]" />}
                        </div>
                        <span className="truncate" title={opt}>
                          {opt}
                        </span>
                      </div>

                      {count !== null && (
                        <span
                          className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ${
                            isSelected
                              ? 'bg-blue-200/70 text-blue-800 font-bold'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>
                {selected.length === 0
                  ? 'Todas ativas'
                  : `${selected.length} de ${options.length} selecionadas`}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer shadow-xs transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
