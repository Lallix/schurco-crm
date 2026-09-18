import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { fetchOmniOrders, peekOmniOrders, type OmniOrderRecord } from '../../lib/omniOrders'

type SortField =
  | 'reference'
  | 'customer_name'
  | 'customer_account'
  | 'line_sales_category'
  | 'sales_rep_name'
  | 'document_date'
  | 'due_date'
  | 'prom_yyyy_mm_dd'
  | 'ordered_qty'
  | 'outstanding_qty_to_deliver'
  | 'currency_code'
  | 'value_excl_after_discount'

type GroupBy = 'none' | 'rep' | 'customer' | 'category'

const NUMBER_FIELDS = new Set<SortField>(['ordered_qty', 'outstanding_qty_to_deliver', 'value_excl_after_discount'])

type Align = 'left' | 'center' | 'right'

const COLUMNS: { field: SortField; label: string; align: Align; tight?: boolean; width: number }[] = [
  { field: 'reference', label: 'Order No.', align: 'left', width: 90 },
  { field: 'customer_name', label: 'Customer', align: 'left', width: 170 },
  { field: 'customer_account', label: 'Account', align: 'left', width: 90 },
  { field: 'line_sales_category', label: 'Category', align: 'left', width: 170 },
  { field: 'sales_rep_name', label: 'Sales Rep', align: 'left', width: 100 },
  { field: 'document_date', label: 'Order Date', align: 'left', width: 95 },
  { field: 'due_date', label: 'Due Date', align: 'left', width: 95 },
  { field: 'prom_yyyy_mm_dd', label: 'Promised Date', align: 'left', width: 110 },
  { field: 'ordered_qty', label: 'Ordered Qty', align: 'center', tight: true, width: 90 },
  { field: 'outstanding_qty_to_deliver', label: 'Outstanding Qty', align: 'center', tight: true, width: 100 },
  { field: 'currency_code', label: 'Currency', align: 'center', tight: true, width: 80 },
  { field: 'value_excl_after_discount', label: 'Value (excl.)', align: 'right', width: 120 },
]

const TABLE_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0)

function fmtMoney(n: number, currency: string) {
  try {
    return n.toLocaleString('en-ZA', { style: 'currency', currency, maximumFractionDigits: 0 })
  } catch {
    return `${currency} ${n.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
  }
}

function fmtQty(n: number) {
  return n.toLocaleString('en-ZA', { maximumFractionDigits: 2 })
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort()
}

function groupKeyFor(o: OmniOrderRecord, groupBy: GroupBy): string {
  if (groupBy === 'rep') return o.sales_rep_name || 'Unassigned'
  if (groupBy === 'customer') return o.customer_name || 'Unknown customer'
  return o.line_sales_category || 'Uncategorized'
}

function subtotals(rows: OmniOrderRecord[]) {
  const byCurrency = new Map<string, number>()
  let qty = 0
  for (const r of rows) {
    byCurrency.set(r.currency_code, (byCurrency.get(r.currency_code) ?? 0) + (Number(r.value_excl_after_discount) || 0))
    qty += Number(r.outstanding_qty_to_deliver) || 0
  }
  return { byCurrency: Array.from(byCurrency.entries()).sort((a, b) => b[1] - a[1]), qty }
}

function toCsv(rows: OmniOrderRecord[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [COLUMNS.map((c) => escape(c.label)).join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.reference,
        r.customer_name,
        r.customer_account,
        r.line_sales_category,
        r.sales_rep_name,
        r.document_date,
        r.due_date,
        r.prom_yyyy_mm_dd,
        r.ordered_qty,
        r.outstanding_qty_to_deliver,
        r.currency_code,
        r.value_excl_after_discount,
      ]
        .map(escape)
        .join(','),
    )
  }
  return lines.join('\n')
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function OrdersPage() {
  const cachedOrders = peekOmniOrders()

  const [orders, setOrders] = useState<OmniOrderRecord[]>(cachedOrders?.orders ?? [])
  const [loading, setLoading] = useState(!cachedOrders)
  const [error, setError] = useState<string | null>(cachedOrders?.error ?? null)
  const [lastFetched, setLastFetched] = useState<Date | null>(cachedOrders?.fetchedAt ?? null)

  const [repFilter, setRepFilter] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [sortField, setSortField] = useState<SortField>('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  async function load(force = false) {
    // Only show the blocking "Loading…" state on a true cold start — if we
    // already have something to show (warm cache, or a previous load),
    // refresh quietly in the background instead of blanking the page.
    if (orders.length === 0) setLoading(true)
    setError(null)
    const { orders: data, error: err, fetchedAt } = await fetchOmniOrders(force)
    setOrders(data)
    setError(err)
    setLastFetched(fetchedAt)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const reps = useMemo(() => uniqueSorted(orders.map((o) => o.sales_rep_name)), [orders])
  const categories = useMemo(() => uniqueSorted(orders.map((o) => o.line_sales_category)), [orders])
  const currencies = useMemo(() => uniqueSorted(orders.map((o) => o.currency_code)), [orders])

  const filtered = useMemo(() => {
    const term = customerSearch.trim().toLowerCase()
    return orders.filter((o) => {
      if (repFilter && o.sales_rep_name !== repFilter) return false
      if (categoryFilter && o.line_sales_category !== categoryFilter) return false
      if (currencyFilter && o.currency_code !== currencyFilter) return false
      if (
        term &&
        !(o.customer_name ?? '').toLowerCase().includes(term) &&
        !(o.customer_account ?? '').toLowerCase().includes(term)
      )
        return false
      if (dateFrom && (!o.document_date || o.document_date < dateFrom)) return false
      if (dateTo && (!o.document_date || o.document_date > dateTo)) return false
      return true
    })
  }, [orders, repFilter, categoryFilter, currencyFilter, customerSearch, dateFrom, dateTo])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (NUMBER_FIELDS.has(sortField)) {
        return ((Number(a[sortField]) || 0) - (Number(b[sortField]) || 0)) * dir
      }
      return String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? '')) * dir
    })
  }, [filtered, sortField, sortDir])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return null
    const map = new Map<string, OmniOrderRecord[]>()
    for (const o of sorted) {
      const key = groupKeyFor(o, groupBy)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [sorted, groupBy])

  const overall = useMemo(() => subtotals(filtered), [filtered])

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(NUMBER_FIELDS.has(field) ? 'desc' : 'asc')
    }
  }

  function exportCsv() {
    const rows = grouped ? grouped.flatMap(([, rows]) => rows) : sorted
    downloadCsv(toCsv(rows), `schurco-open-sales-orders-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function clearFilters() {
    setRepFilter('')
    setCustomerSearch('')
    setCategoryFilter('')
    setCurrencyFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const filtersActive = !!(repFilter || customerSearch || categoryFilter || currencyFilter || dateFrom || dateTo)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1>Open Sales Orders</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastFetched && (
            <span style={{ fontSize: '8pt', color: 'var(--muted)' }}>
              Last fetched: {lastFetched.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={() => load(true)} disabled={loading} style={secondaryBtn}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={exportCsv} disabled={loading || sorted.length === 0} style={secondaryBtn}>
            Export to CSV
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--muted)' }}>
        Live, read-only view from OMNI. Kept from your last fetch this session — select Refresh for the latest, or
        reload the page. Nothing here is ever written back to OMNI.
      </p>

      {error && (
        <div style={{ color: 'var(--danger)', background: '#fdeaea', border: '1px solid var(--danger)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
          Couldn't load orders: {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <SummaryTile label="Open orders" value={String(filtered.length)} />
          {overall.byCurrency.length === 0 ? (
            <SummaryTile label="Outstanding value" value="—" />
          ) : (
            overall.byCurrency.map(([cur, val]) => (
              <SummaryTile key={cur} label={`Outstanding value (${cur})`} value={fmtMoney(val, cur)} />
            ))
          )}
          <SummaryTile label="Outstanding qty" value={fmtQty(overall.qty)} />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <FilterField label="Sales rep">
          <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} style={selectStyle}>
            <option value="">All reps</option>
            {reps.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Customer">
          <input
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Search customer or account…"
            style={{ ...selectStyle, width: 180 }}
          />
        </FilterField>
        <FilterField label="Category">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={selectStyle}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Currency">
          <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} style={selectStyle}>
            <option value="">All currencies</option>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Order date from">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={selectStyle} />
        </FilterField>
        <FilterField label="Order date to">
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={selectStyle} />
        </FilterField>
        {filtersActive && (
          <button onClick={clearFilters} style={secondaryBtn}>
            Clear filters
          </button>
        )}
      </div>

      <div className="group-toggle-row">
        {(['none', 'rep', 'customer', 'category'] as GroupBy[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroupBy(g)}
            style={{
              ...secondaryBtn,
              background: groupBy === g ? 'var(--green)' : 'var(--surface)',
              color: groupBy === g ? '#fff' : 'var(--ink)',
              borderColor: groupBy === g ? 'var(--green)' : 'var(--border)',
            }}
          >
            {g === 'none' ? 'No grouping' : `Group by ${g === 'rep' ? 'sales rep' : g}`}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : sorted.length === 0 && !error ? (
        <p style={{ color: 'var(--muted)' }}>{filtersActive ? 'No orders match your filters.' : 'No open sales orders returned.'}</p>
      ) : grouped ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {grouped.map(([key, rows]) => {
            const sub = subtotals(rows)
            return (
              <details key={key} open style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
                <summary
                  className="disclosure"
                  style={{
                    cursor: 'pointer',
                    padding: '0.7rem 0.9rem',
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <span>
                    <span className="chevron">▶</span>
                    {key} <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '9pt' }}>({rows.length})</span>
                  </span>
                  <span style={{ fontWeight: 400, fontSize: '9pt', color: 'var(--muted)' }}>
                    {sub.byCurrency.map(([cur, val]) => fmtMoney(val, cur)).join(' · ')} · {fmtQty(sub.qty)} qty
                  </span>
                </summary>
                <div className="table-scroll">
                  <OrdersTable rows={rows} sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                </div>
              </details>
            )
          })}
        </div>
      ) : (
        <div className="table-scroll">
          <OrdersTable rows={sorted} sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
        </div>
      )}
    </div>
  )
}

function OrdersTable({
  rows,
  sortField,
  sortDir,
  onSort,
}: {
  rows: OmniOrderRecord[]
  sortField: SortField
  sortDir: 'asc' | 'desc'
  onSort: (field: SortField) => void
}) {
  return (
    <table
      style={{
        width: '100%',
        minWidth: TABLE_WIDTH,
        borderCollapse: 'collapse',
        background: 'var(--surface)',
        tableLayout: 'fixed',
      }}
    >
      <colgroup>
        {COLUMNS.map((c) => (
          <col key={c.field} style={{ width: c.width }} />
        ))}
      </colgroup>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
          {COLUMNS.map((c) => (
            <Th key={c.field} field={c.field} active={sortField === c.field} dir={sortDir} onSort={onSort} align={c.align} tight={c.tight}>
              {c.label}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.reference}-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
            <Td>{r.reference}</Td>
            <Td>{r.customer_name}</Td>
            <Td>{r.customer_account}</Td>
            <Td>{r.line_sales_category || '—'}</Td>
            <Td>{r.sales_rep_name || '—'}</Td>
            <Td>{r.document_date ?? '—'}</Td>
            <Td>{r.due_date ?? '—'}</Td>
            <Td>{r.prom_yyyy_mm_dd ?? '—'}</Td>
            <Td align="center" tight>{fmtQty(r.ordered_qty)}</Td>
            <Td align="center" tight>{fmtQty(r.outstanding_qty_to_deliver)}</Td>
            <Td align="center" tight>{r.currency_code}</Td>
            <Td align="right">{fmtMoney(r.value_excl_after_discount, r.currency_code)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Th({
  children,
  field,
  active,
  dir,
  onSort,
  align,
  tight,
}: {
  children?: ReactNode
  field: SortField
  active: boolean
  dir: 'asc' | 'desc'
  onSort: (field: SortField) => void
  align: Align
  tight?: boolean
}) {
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: tight ? '0.6rem 0.4rem' : '0.6rem',
        fontSize: '9pt',
        color: active ? 'var(--green-dark)' : 'var(--muted)',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textAlign: align,
      }}
    >
      {children}
      <span style={{ marginLeft: '0.25rem', opacity: active ? 1 : 0.3 }}>{active && dir === 'asc' ? '▲' : '▼'}</span>
    </th>
  )
}

function Td({ children, align = 'left', tight }: { children?: ReactNode; align?: Align; tight?: boolean }) {
  return (
    <td
      style={{
        padding: tight ? '0.6rem 0.4rem' : '0.6rem',
        fontSize: '9pt',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textAlign: align,
      }}
    >
      {children}
    </td>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', minWidth: 180 }}>
      <div style={{ fontSize: '8pt', color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: '13pt', fontWeight: 700, color: 'var(--green-dark)' }}>{value}</div>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '8pt', color: 'var(--muted)', marginBottom: '0.2rem' }}>{label}</div>
      {children}
    </label>
  )
}

const secondaryBtn: CSSProperties = {
  padding: '0.5rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const selectStyle: CSSProperties = {
  padding: '0.45rem 0.6rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
}
