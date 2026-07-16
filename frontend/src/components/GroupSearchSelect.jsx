import { useEffect, useMemo, useRef, useState } from 'react'

export default function GroupSearchSelect({
  groups,
  value,
  onChange,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const selected = groups.find((group) => group.name === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((group) => group.name.toLowerCase().includes(q))
  }, [groups, query])

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  function openDropdown() {
    if (disabled) return
    setOpen(true)
  }

  function handleSelect(groupName) {
    onChange(groupName)
    setOpen(false)
    setQuery('')
  }

  return (
    <div
      className={`group-picker ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      ref={containerRef}
    >
      {selected && !open && (
        <div className="group-picker-current">
          <p className="group-picker-current-label">Current group</p>
          <p className="group-picker-current-name">{selected.name}</p>
          <p className="group-picker-current-meta">
            {selected.submitted_count}/{selected.member_count} submitted
          </p>
        </div>
      )}

      <button
        type="button"
        className="group-picker-trigger"
        onClick={() => {
          if (open) {
            setOpen(false)
            setQuery('')
          } else {
            openDropdown()
          }
        }}
        disabled={disabled}
        aria-expanded={open}
      >
        <span>
          {open
            ? 'Search or pick a group'
            : selected
              ? 'Change group'
              : 'Select a group'}
        </span>
        <span className="group-picker-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="group-picker-dropdown">
          <input
            ref={inputRef}
            id="group-search"
            type="text"
            className="group-picker-search"
            placeholder="Type to search groups…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={disabled}
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false)
                setQuery('')
              }
              if (event.key === 'Enter' && filtered.length === 1) {
                handleSelect(filtered[0].name)
              }
            }}
          />

          <div className="group-picker-list" role="listbox" aria-label="Groups">
            {filtered.length === 0 ? (
              <p className="group-picker-empty">No groups match “{query}”</p>
            ) : (
              filtered.map((group) => (
                <button
                  key={group.name}
                  type="button"
                  role="option"
                  aria-selected={group.name === value}
                  className={`group-picker-option ${group.name === value ? 'active' : ''}`}
                  onClick={() => handleSelect(group.name)}
                  disabled={disabled}
                >
                  <span className="group-option-name">{group.name}</span>
                  <span className="group-option-meta">
                    {group.submitted_count}/{group.member_count} submitted
                  </span>
                </button>
              ))
            )}
          </div>

          <p className="group-picker-count">
            Showing {filtered.length} of {groups.length} groups
          </p>
        </div>
      )}
    </div>
  )
}
