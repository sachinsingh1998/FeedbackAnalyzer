import { useEffect, useMemo, useRef, useState } from 'react'

export default function StudentSearchSelect({
  students,
  onSelect,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^z/, '')
    if (!q) return students.slice(0, 40)
    return students
      .filter((student) => {
        const name = (student.name || '').toLowerCase()
        const zid = student.zid.toLowerCase()
        const email = (student.email || '').toLowerCase()
        return (
          name.includes(q) ||
          zid.includes(q) ||
          `z${zid}`.includes(query.trim().toLowerCase()) ||
          email.includes(q)
        )
      })
      .slice(0, 40)
  }, [students, query])

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(student) {
    onSelect(student)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={`search-box ${open ? 'open' : ''}`} ref={containerRef}>
      <input
        type="text"
        className="search-box-input"
        placeholder="Search student by name or zID…"
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
            handleSelect(filtered[0])
          }
        }}
      />

      {open && !disabled && (
        <div className="search-box-dropdown">
          <div className="search-box-list" role="listbox">
            {filtered.length === 0 ? (
              <p className="search-box-empty">
                {students.length === 0
                  ? 'No students loaded yet.'
                  : `No students match “${query}”`}
              </p>
            ) : (
              filtered.map((student) => (
                <button
                  key={`${student.group}-${student.zid}`}
                  type="button"
                  className="search-box-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(student)}
                >
                  <span className="search-option-name">
                    {student.name || `z${student.zid}`}
                    <span className="student-option-zid">z{student.zid}</span>
                  </span>
                  <span className="search-option-meta">{student.group}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
