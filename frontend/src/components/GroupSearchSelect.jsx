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
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(groupName) {
    onChange(groupName)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={`search-box ${open ? 'open' : ''}`} ref={containerRef}>
      {selected && (
        <div className="search-box-current">
          <p className="search-box-current-label">Current group</p>
          <p className="search-box-current-name">{selected.name}</p>
          <p className="search-box-current-meta">
            {selected.submitted_count}/{selected.member_count} submitted
          </p>
        </div>
      )}

      <input
        id="group-search"
        type="text"
        className="search-box-input"
        placeholder="Search groups…"
        value={query}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter' && filtered.length === 1) {
            handleSelect(filtered[0].name)
          }
        }}
      />

      {open && !disabled && (
        <div className="search-box-dropdown">
          <div className="search-box-list">
            {filtered.length === 0 ? (
              <p className="search-box-empty">
                {groups.length === 0 ? 'No groups loaded yet.' : `No groups match “${query}”`}
              </p>
            ) : (
              filtered.map((group) => (
                <button
                  key={group.name}
                  type="button"
                  className={`search-box-option ${group.name === value ? 'active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(group.name)}
                >
                  <span className="search-option-name">{group.name}</span>
                  <span className="search-option-meta">
                    {group.submitted_count}/{group.member_count} submitted
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
