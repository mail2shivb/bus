import React, { useEffect, useMemo, useRef, useState } from 'react'

const API = 'http://localhost:8080/api'

export default function App() {
  const [fileName, setFileName] = useState('Citi10K.pdf')
  const [query, setQuery] = useState('risk factor')
  const [activeTab, setActiveTab] = useState('pdf')

  const [pages, setPages] = useState([])
  const [idx, setIdx] = useState(0)
  const current = pages[idx] || null

  const [metrics, setMetrics] = useState(null)
  const [lastHeaders, setLastHeaders] = useState({})

  const [imgUrl, setImgUrl] = useState('')
  const [boxes, setBoxes] = useState([])
  const [hitIdx, setHitIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function runSearch() {
    setError(''); setLoading(true)
    try {
      const res = await fetch(`${API}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, query })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const basic = (data.pages || []).map(p => ({ pageNumber: p.pageNumber, occurrences: p.occurrences, pageMarkdown: p.pageMarkdown }))
      setPages(basic); setIdx(0); setHitIdx(0)
      setMetrics({ docLoadMs: data.docLoadMs, scanMs: data.scanMs, pagesScanned: data.pagesScanned, parallelism: data.parallelism })
    } catch (e) {
      setError(String(e.message || e)); setPages([]); setMetrics(null)
    } finally { setLoading(false) }
  }

  async function loadCurrent() {
    if (!current) { setImgUrl(''); setBoxes([]); return }
    setError(''); setLoading(true)
    try {
      const p = current.pageNumber
      const imgRes = await fetch(`${API}/page-image?` + new URLSearchParams({ fileName, page: String(p) }))
      const hdrs = { imgDocLoadMs: imgRes.headers.get('X-Doc-Load-ms'), imgRenderMs: imgRes.headers.get('X-Render-ms') }
      const blob = await imgRes.blob()
      setImgUrl(URL.createObjectURL(blob))

      const bRes = await fetch(`${API}/page-matches?` + new URLSearchParams({ fileName, query, page: String(p) }))
      const hdrs2 = { boxesDocLoadMs: bRes.headers.get('X-Doc-Load-ms'), boxesMs: bRes.headers.get('X-Boxes-ms') }
      const rects = await bRes.json()
      setBoxes(rects || []); setHitIdx(0)
      setLastHeaders({ ...hdrs, ...hdrs2 })
    } catch (e) {
      setError(String(e.message || e)); setBoxes([])
    } finally { setLoading(false) }
  }

  useEffect(() => { /* initial */ }, [])
  useEffect(() => { if (pages.length) loadCurrent() }, [idx, pages, activeTab])

  function prevPage() { if (pages.length) setIdx(i => (i - 1 + pages.length) % pages.length) }
  function nextPage() { if (pages.length) setIdx(i => (i + 1) % pages.length) }
  function prevHit() { if (boxes.length) setHitIdx(i => (i - 1 + boxes.length) % boxes.length) }
  function nextHit() { if (boxes.length) setHitIdx(i => (i + 1) % boxes.length) }

  const imgRef = useRef(null)
  const [natural, setNatural] = useState({w:0,h:0})
  function onImgLoad(e) {
    const el = e.currentTarget
    setNatural({ w: el.naturalWidth, h: el.naturalHeight })
  }

  return (
    <div className="container">
      <h1>PDF Highlight Viewer</h1>
      <div className="card">
        <label>PDF file name</label>
        <input value={fileName} onChange={e => setFileName(e.target.value)} />
        <label>Search text</label>
        <input value={query} onChange={e => setQuery(e.target.value)} />
        <div className="toolbar">
          <button onClick={runSearch} disabled={loading}>{loading ? 'Loading...' : 'Search'}</button>
          <button className="secondary" onClick={prevPage} disabled={!pages.length}>Prev Page</button>
          <button className="secondary" onClick={nextPage} disabled={!pages.length}>Next Page</button>
          <button className="secondary" onClick={prevHit} disabled={!boxes.length}>Prev Hit</button>
          <button className="secondary" onClick={nextHit} disabled={!boxes.length}>Next Hit</button>
          {!!current && <span style={{marginLeft:8}}>Page {current.pageNumber} • {current.occurrences} hits</span>}
        </div>
        <div className="tabs">
          <div className={`tab ${activeTab==='pdf'?'active':''}`} onClick={() => setActiveTab('pdf')}>PDF</div>
          <div className={`tab ${activeTab==='markdown'?'active':''}`} onClick={() => setActiveTab('markdown')}>Markdown</div>
        </div>
        {metrics && (
          <div className="metrics">
            search: docLoad {metrics.docLoadMs}ms • scan {metrics.scanMs}ms • pages {metrics.pagesScanned} • threads {metrics.parallelism}
          </div>
        )}
        {Object.keys(lastHeaders).length>0 && (
          <div className="metrics">
            image: load {lastHeaders.imgDocLoadMs}ms • render {lastHeaders.imgRenderMs}ms | boxes: load {lastHeaders.boxesDocLoadMs}ms • build {lastHeaders.boxesMs}ms
          </div>
        )}
        {error && <p style={{color:'crimson'}}>{error}</p>}
      </div>

      <div className="card viewer">
        {!current && <p>Click Search to load matches.</p>}

        {current && activeTab==='pdf' && (
          <div className="page-wrap">
            <img ref={imgRef} onLoad={onImgLoad} alt={`Page ${current.pageNumber}`} src={imgUrl}
                 style={{ width: 'min(900px, 95vw)', height: 'auto', display: 'block', borderRadius: 8 }} />
            {natural.w>0 && natural.h>0 && (
              <svg className="overlay" style={{ position:'absolute', left:0, top:0, width:'min(900px, 95vw)', height:'auto', pointerEvents:'none'}}
                   viewBox={`0 0 ${natural.w} ${natural.h}`} preserveAspectRatio="xMinYMin meet">
                {boxes.map((r, i) => (
                  <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} className={i===hitIdx?'current':''} />
                ))}
              </svg>
            )}
          </div>
        )}

        {current && activeTab==='markdown' && (
          <MarkdownView md={current.pageMarkdown} query={query} hitIdx={hitIdx} setHitIdx={setHitIdx} />
        )}
      </div>
    </div>
  )
}

function MarkdownView({ md, query, hitIdx, setHitIdx }) {
  const containerRef = useRef(null)
  const rendered = useMemo(() => {
    if (!md) return null
    const code = md.replace(/^```text\n/, '').replace(/\n```$/, '')
    if (!query) return <pre>{code}</pre>
    const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(safeQ, 'gi')
    const parts = code.split(re)
    const matches = code.match(re) || []
    const elems = []
    for (let i=0; i<parts.length; i++) {
      elems.push(<span key={'p'+i}>{parts[i]}</span>)
      if (i < matches.length) elems.push(<mark key={'m'+i} data-hit-idx={i}>{matches[i]}</mark>)
    }
    return <pre ref={containerRef}>{elems}</pre>
  }, [md, query])

  useEffect(() => {
    if (!containerRef.current) return
    const nodes = containerRef.current.querySelectorAll('mark')
    nodes.forEach(n => n.style.outline = 'none')
    if (nodes.length === 0) return
    const node = nodes[hitIdx % nodes.length]
    node.style.outline = '2px solid orange'
    node.scrollIntoView({ behavior:'smooth', block:'center' })
  }, [rendered, hitIdx])

  return rendered
}
