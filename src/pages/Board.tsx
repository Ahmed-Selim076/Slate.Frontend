import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  getBoard,
  updateBoardElements,
  renameBoard,
  listBoardMembers,
  updateMemberRole,
  getStoredUser,
  ApiError,
  type BoardMember,
} from '../lib/api'
import { createBoardConnection, type RemoteCursor } from '../lib/signalr'
import type * as signalR from '@microsoft/signalr'

// --- Element model ---
interface StrokeEl {
  id: string
  kind: 'stroke'
  points: [number, number][]
  color: string
  width: number
}
interface TextEl {
  id: string
  kind: 'text'
  x: number
  y: number
  text: string
  color: string
}
interface StickyEl {
  id: string
  kind: 'sticky'
  x: number
  y: number
  text: string
  color: string
}
interface ImageEl {
  id: string
  kind: 'image'
  x: number
  y: number
  width: number
  height: number
  src: string // base64 data URL — small board, no separate file storage yet
}
type BoardEl = StrokeEl | TextEl | StickyEl | ImageEl

function normalizeElement(raw: unknown): BoardEl {
  const el = raw as Record<string, unknown>
  if (!el.kind && Array.isArray(el.points)) {
    return { ...el, kind: 'stroke' } as unknown as StrokeEl
  }
  return el as unknown as BoardEl
}

const STROKE_WIDTHS = { thin: 2, medium: 4, thick: 8 } as const
const STROKE_COLORS = ['#EDEDEF', '#2FBE8F', '#6C8CF5', '#E5A15C', '#E5686E', '#A78BFA']
const STICKY_COLORS = ['#F4D35E', '#F79D65', '#8FD4A8', '#8FB8F4', '#E896C4']
const CURSOR_COLORS = ['#2FBE8F', '#6C8CF5', '#E5A15C', '#E5686E', '#A78BFA', '#4FB8D6']
const MIN_SCALE = 0.2
const MAX_SCALE = 4

function cursorColorFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

let stickyColorCursor = 0

export default function Board() {
  const { boardId } = useParams({ from: '/board/$boardId' })
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [elements, setElements] = useState<BoardEl[]>([])
  const currentStroke = useRef<StrokeEl | null>(null)

  const [boardTitle, setBoardTitle] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)

  const [myRole, setMyRole] = useState<'Owner' | 'Editor' | 'Viewer'>('Editor')
  const isViewer = myRole === 'Viewer'
  const isOwner = myRole === 'Owner'

  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<BoardMember[]>([])
  const [shareCopied, setShareCopied] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)

  const [color, setColor] = useState(STROKE_COLORS[1])
  const [width, setWidth] = useState<keyof typeof STROKE_WIDTHS>('medium')
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({})
  const lastCursorSent = useRef(0)
  const lastStrokeSent = useRef(0)
  const knownElementIds = useRef<Set<string>>(new Set())

  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const pendingFocusId = useRef<string | null>(null)

  // --- Pan & zoom (world-space coordinates independent of screen) ---
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const panState = useRef<{ startX: number; startY: number; viewX: number; viewY: number } | null>(null)
  const isSpacePanning = useRef(false)

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({ x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale }),
    [view],
  )

  // --- Load + persist ---

  useEffect(() => {
    if (!getStoredUser()) {
      navigate({ to: '/login' })
      return
    }
    getBoard(boardId)
      .then((board) => {
        setBoardTitle(board.title)
        setTitleDraft(board.title)
        setMyRole(board.myRole)
        try {
          const raw = JSON.parse(board.elementsJson) as unknown[]
          const loaded = raw.map(normalizeElement)
          setElements(loaded)
          knownElementIds.current = new Set(loaded.map((s) => s.id))
        } catch {
          setElements([])
        }
        setSaveState('saved')
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate({ to: '/login' })
        } else {
          setSaveState('error')
        }
      })
  }, [boardId])

  useEffect(() => {
    const connection = createBoardConnection()
    connectionRef.current = connection

    connection.on('ReceiveElement', (elementJson: string) => {
      try {
        const incoming = normalizeElement(JSON.parse(elementJson))
        if (knownElementIds.current.has(incoming.id)) {
          setElements((prev) => prev.map((e) => (e.id === incoming.id ? incoming : e)))
        } else {
          knownElementIds.current.add(incoming.id)
          setElements((prev) => [...prev, incoming])
        }
      } catch {
        // ignore malformed payloads
      }
    })

    connection.on('ReceiveCursor', (cursor: RemoteCursor) => {
      setRemoteCursors((prev) => ({ ...prev, [cursor.connectionId]: cursor }))
    })

    connection.on('UserLeft', (connectionId: string) => {
      setRemoteCursors((prev) => {
        const next = { ...prev }
        delete next[connectionId]
        return next
      })
    })

    connection.on('ElementDeleted', (elementId: string) => {
      knownElementIds.current.delete(elementId)
      setElements((prev) => prev.filter((e) => e.id !== elementId))
    })

    connection
      .start()
      .then(() => connection.invoke('JoinBoard', boardId))
      .catch(() => setSaveState('error'))

    return () => {
      connection.invoke('LeaveBoard', boardId).catch(() => {})
      connection.stop()
      connectionRef.current = null
    }
  }, [boardId])

  // Focus a newly created text/sticky note once its textarea has mounted.
  useEffect(() => {
    if (pendingFocusId.current) {
      const el = textareaRefs.current[pendingFocusId.current]
      el?.focus()
      pendingFocusId.current = null
    }
  }, [elements])

  // Show the how-to-navigate tutorial once per browser, the first time any board is opened.
  useEffect(() => {
    if (!localStorage.getItem('slate_seen_board_tutorial')) {
      setShowTutorial(true)
      localStorage.setItem('slate_seen_board_tutorial', '1')
    }
  }, [])

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      prompt('Copy this link:', window.location.href)
    }
  }

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ')
    let line = ''
    let cy = y
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy)
        line = word
        cy += lineHeight
      } else {
        line = test
      }
    }
    if (line) ctx.fillText(line, x, cy)
  }

  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    const strokes = elements.filter((e): e is StrokeEl => e.kind === 'stroke')
    const notes = elements.filter((e): e is TextEl | StickyEl => e.kind === 'text' || e.kind === 'sticky')
    const images = elements.filter((e): e is ImageEl => e.kind === 'image')

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const consider = (x: number, y: number) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
    strokes.forEach((s) => s.points.forEach(([x, y]) => consider(x, y)))
    notes.forEach((n) => {
      consider(n.x, n.y)
      consider(n.x + (n.kind === 'sticky' ? 160 : 200), n.y + (n.kind === 'sticky' ? 120 : 30))
    })
    images.forEach((im) => {
      consider(im.x, im.y)
      consider(im.x + im.width, im.y + im.height)
    })

    if (!isFinite(minX)) {
      alert('Nothing to export yet — draw something first.')
      return
    }

    setExporting(true)
    const PAD = 40
    minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD
    const width = Math.ceil(maxX - minX)
    const height = Math.ceil(maxY - minY)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#101113'
    ctx.fillRect(0, 0, width, height)
    ctx.translate(-minX, -minY)

    strokes.forEach((s) => {
      if (s.points.length < 2) return
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.stroke()
    })

    notes.forEach((n) => {
      if (n.kind === 'sticky') {
        ctx.fillStyle = n.color
        ctx.fillRect(n.x, n.y, 160, 120)
        ctx.fillStyle = '#1A1610'
        ctx.font = '14px sans-serif'
        wrapText(ctx, n.text, n.x + 8, n.y + 24, 144, 18)
      } else {
        ctx.fillStyle = n.color
        ctx.font = '600 20px sans-serif'
        ctx.fillText(n.text, n.x, n.y + 20)
      }
    })

    await Promise.all(
      images.map(
        (im) =>
          new Promise<void>((resolve) => {
            const imgEl = new Image()
            imgEl.onload = () => {
              ctx.drawImage(imgEl, im.x, im.y, im.width, im.height)
              resolve()
            }
            imgEl.onerror = () => resolve()
            imgEl.src = im.src
          }),
      ),
    )

    canvas.toBlob((blob) => {
      setExporting(false)
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(boardTitle || 'slate-board').replace(/[^a-z0-9-_]+/gi, '-')}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const scheduleSave = useCallback(
    (next: BoardEl[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveState('saving')
      saveTimer.current = setTimeout(async () => {
        try {
          await updateBoardElements(boardId, JSON.stringify(next))
          setSaveState('saved')
        } catch {
          setSaveState('error')
        }
      }, 600)
    },
    [boardId],
  )

  const broadcastElement = (el: BoardEl) => {
    connectionRef.current?.invoke('SendElement', boardId, JSON.stringify(el)).catch(() => {})
  }

  // --- Title ---

  const commitTitle = async () => {
    setEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (!trimmed || trimmed === boardTitle) {
      setTitleDraft(boardTitle)
      return
    }
    setBoardTitle(trimmed)
    try {
      await renameBoard(boardId, trimmed)
    } catch {
      setBoardTitle(boardTitle)
    }
  }

  // --- Collaborators ---

  const openMembers = async () => {
    setShowMembers(true)
    try {
      setMembers(await listBoardMembers(boardId))
    } catch {
      // silently ignore; panel will just show nothing
    }
  }

  const handleRoleChange = async (userId: string, role: 'Editor' | 'Viewer') => {
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)))
    try {
      await updateMemberRole(boardId, userId, role)
    } catch {
      openMembers()
    }
  }

  // --- Canvas drawing ---

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'rgba(237,237,239,0.05)'
    const gridSize = 24 * view.scale
    const offsetX = view.x % gridSize
    const offsetY = view.y % gridSize
    for (let x = offsetX; x < canvas.width; x += gridSize) {
      for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.fillRect(x, y, 1, 1)
      }
    }

    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y)

    const strokes = elements.filter((e): e is StrokeEl => e.kind === 'stroke')
    const allStrokes = currentStroke.current ? [...strokes, currentStroke.current] : strokes
    allStrokes.forEach((s) => {
      if (s.points.length < 2) return
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
      ctx.stroke()
    })
  }, [elements, view])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      redraw()
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [redraw])

  useEffect(() => {
    redraw()
  }, [redraw])

  const getWorldPos = (clientX: number, clientY: number): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const w = screenToWorld(clientX - rect.left, clientY - rect.top)
    return [w.x, w.y]
  }

  // --- Tools ---

  const tools = [
    { key: 'select', label: 'V', icon: '↖' },
    { key: 'pen', label: 'P', icon: '✎' },
    { key: 'eraser', label: 'E', icon: '⌫' },
    { key: 'sticky', label: 'S', icon: '▤' },
    { key: 'text', label: 'T', icon: 'T' },
    { key: 'image', label: 'I', icon: '🖼' },
  ]
  const [activeTool, setActiveTool] = useState('pen')
  const erasingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      const img = new Image()
      img.onload = () => {
        const MAX_DIM = 320
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
        const width = Math.round(img.width * scale)
        const height = Math.round(img.height * scale)

        const rect = containerRef.current!.getBoundingClientRect()
        const center = screenToWorld(rect.width / 2, rect.height / 2)

        addElement({
          id: crypto.randomUUID(),
          kind: 'image',
          x: center.x - width / 2,
          y: center.y - height / 2,
          width,
          height,
          src,
        })
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  const addElement = (el: BoardEl) => {
    knownElementIds.current.add(el.id)
    const next = [...elements, el]
    setElements(next)
    scheduleSave(next)
    broadcastElement(el)
  }

  const updateElement = (id: string, patch: { text?: string; x?: number; y?: number }) => {
    setElements((prev) => {
      const next = prev.map((e) => (e.id === id ? ({ ...(e as object), ...patch } as BoardEl) : e))
      scheduleSave(next)
      const updated = next.find((e) => e.id === id)
      if (updated) broadcastElement(updated)
      return next
    })
  }

  const deleteElementById = (id: string) => {
    knownElementIds.current.delete(id)
    setElements((prev) => {
      const next = prev.filter((e) => e.id !== id)
      scheduleSave(next)
      return next
    })
    connectionRef.current?.invoke('DeleteElement', boardId, id).catch(() => {})
  }

  // Point-to-segment distance, used to hit-test strokes for the eraser.
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy
    let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const projX = x1 + t * dx
    const projY = y1 + t * dy
    return Math.hypot(px - projX, py - projY)
  }

  const ERASE_RADIUS = 10

  const eraseAt = (x: number, y: number): string | null => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i]
      if (el.kind === 'stroke') {
        for (let j = 0; j < el.points.length - 1; j++) {
          const [x1, y1] = el.points[j]
          const [x2, y2] = el.points[j + 1]
          if (distToSegment(x, y, x1, y1, x2, y2) < ERASE_RADIUS + el.width / 2) return el.id
        }
      } else if (el.kind === 'sticky') {
        if (x >= el.x && x <= el.x + 160 && y >= el.y && y <= el.y + 120) return el.id
      } else if (el.kind === 'text') {
        const w = Math.max(40, (el.text.length + 2) * 10)
        if (x >= el.x && x <= el.x + w && y >= el.y && y <= el.y + 30) return el.id
      } else if (el.kind === 'image') {
        if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) return el.id
      }
    }
    return null
  }

  const activePointerId = useRef<number | null>(null)

  const stopGestureTracking = () => {
    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', handleWindowPointerUp)
    activePointerId.current = null
  }

  const broadcastCursor = (clientX: number, clientY: number) => {
    const [x, y] = getWorldPos(clientX, clientY)
    const now = performance.now()
    if (now - lastCursorSent.current > 50) {
      lastCursorSent.current = now
      connectionRef.current?.invoke('SendCursor', boardId, { x, y }).catch(() => {})
    }
  }

  const handleGestureMove = (clientX: number, clientY: number) => {
    if (dragState.current) {
      handleNoteDragMove(clientX, clientY)
      return
    }

    if (panState.current) {
      const dx = clientX - panState.current.startX
      const dy = clientY - panState.current.startY
      setView((v) => ({ ...v, x: panState.current!.viewX + dx, y: panState.current!.viewY + dy }))
      return
    }

    const [x, y] = getWorldPos(clientX, clientY)

    if (erasingRef.current) {
      const hitId = eraseAt(x, y)
      if (hitId) deleteElementById(hitId)
    }

    if (!currentStroke.current) return
    currentStroke.current.points.push([x, y])
    redraw()

    // Broadcast the in-progress stroke so other users see it grow live,
    // instead of only seeing it once the pen lifts. Reuses the same
    // ReceiveElement channel — the receiver updates it in place by id.
    const now = performance.now()
    if (now - lastStrokeSent.current > 50) {
      lastStrokeSent.current = now
      knownElementIds.current.add(currentStroke.current.id)
      broadcastElement(currentStroke.current)
    }
  }

  const handleGestureUp = () => {
    panState.current = null
    erasingRef.current = false
    if (currentStroke.current) {
      const finished = currentStroke.current
      currentStroke.current = null
      addElement(finished)
    }
    finishNoteDrag()
    stopGestureTracking()
  }

  // Bound once, reused as the same function reference so add/removeEventListener match.
  const handleWindowPointerMove = (e: PointerEvent) => handleGestureMove(e.clientX, e.clientY)
  const handleWindowPointerUp = () => handleGestureUp()

  const startGestureTracking = () => {
    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerUp)
  }

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || isSpacePanning.current) {
      panState.current = { startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y }
      startGestureTracking()
      return
    }

    if (isViewer) return

    const [x, y] = getWorldPos(e.clientX, e.clientY)

    if (activeTool === 'text' || activeTool === 'sticky') {
      const id = crypto.randomUUID()
      if (activeTool === 'text') {
        addElement({ id, kind: 'text', x, y, text: '', color })
      } else {
        const stickyColor = STICKY_COLORS[stickyColorCursor % STICKY_COLORS.length]
        stickyColorCursor += 1
        addElement({ id, kind: 'sticky', x, y, text: '', color: stickyColor })
      }
      setActiveTool('select')
      pendingFocusId.current = id
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      return
    }
    if (activeTool === 'eraser') {
      erasingRef.current = true
      const hitId = eraseAt(x, y)
      if (hitId) deleteElementById(hitId)
      startGestureTracking()
      return
    }
    if (activeTool !== 'pen') return

    currentStroke.current = {
      id: crypto.randomUUID(),
      kind: 'stroke',
      points: [[x, y]],
      color,
      width: STROKE_WIDTHS[width],
    }
    startGestureTracking()
  }

  const handleUndo = () => {
    if (isViewer) return
    const next = elements.slice(0, -1)
    setElements(next)
    scheduleSave(next)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const rect = containerRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.001)
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
        const worldX = (cx - v.x) / v.scale
        const worldY = (cy - v.y) / v.scale
        return { scale: newScale, x: cx - worldX * newScale, y: cy - worldY * newScale }
      })
    } else {
      setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
  }

  const zoomBy = (factor: number) => {
    setView((v) => {
      const rect = containerRef.current!.getBoundingClientRect()
      const cx = rect.width / 2
      const cy = rect.height / 2
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
      const worldX = (cx - v.x) / v.scale
      const worldY = (cy - v.y) / v.scale
      return { scale: newScale, x: cx - worldX * newScale, y: cy - worldY * newScale }
    })
  }

  const resetView = () => setView({ scale: 1, x: 0, y: 0 })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') isSpacePanning.current = true
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') isSpacePanning.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      stopGestureTracking()
    }
  }, [])

  // --- Dragging text/sticky notes/images ---

  const handleNoteDragStart = (e: React.PointerEvent, el: TextEl | StickyEl | ImageEl) => {
    if (isViewer) return
    e.stopPropagation()
    const rect = containerRef.current!.getBoundingClientRect()
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    dragState.current = { id: el.id, offsetX: world.x - el.x, offsetY: world.y - el.y }
    startGestureTracking()
  }

  const lastDragSent = useRef(0)

  const handleNoteDragMove = (clientX: number, clientY: number) => {
    if (!dragState.current) return
    const rect = containerRef.current!.getBoundingClientRect()
    const world = screenToWorld(clientX - rect.left, clientY - rect.top)
    const x = world.x - dragState.current.offsetX
    const y = world.y - dragState.current.offsetY
    let moved: BoardEl | undefined
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== dragState.current!.id) return el
        moved = { ...(el as object), x, y } as BoardEl
        return moved
      }),
    )
    const now = performance.now()
    if (moved && now - lastDragSent.current > 50) {
      lastDragSent.current = now
      broadcastElement(moved)
    }
  }

  const finishNoteDrag = () => {
    if (!dragState.current) return
    const id = dragState.current.id
    dragState.current = null
    setElements((prev) => {
      scheduleSave(prev)
      const updated = prev.find((e) => e.id === id)
      if (updated) broadcastElement(updated)
      return prev
    })
  }

  const worldToScreen = (wx: number, wy: number) => ({ x: wx * view.scale + view.x, y: wy * view.scale + view.y })

  const saveLabel = {
    idle: '',
    loading: 'Loading…',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Could not save',
  }[saveState]

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen bg-[var(--color-bg)] relative overflow-hidden"
      onWheel={handleWheel}
    >
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 z-30">
        <div className="panel px-4 py-2 flex items-center gap-3">
          <Link to="/dashboard" className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm">
            ← Boards
          </Link>
          <span className="text-[var(--color-border-hover)]">|</span>
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="text-sm font-medium bg-transparent outline-none border-b border-[var(--color-accent)]"
            />
          ) : (
            <button
              onClick={() => !isViewer && setEditingTitle(true)}
              className="text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
              title={isViewer ? undefined : 'Click to rename'}
            >
              {boardTitle || 'Board'}
            </button>
          )}
          {isViewer && (
            <span className="text-xs font-mono text-[var(--color-text-dim)] bg-[var(--color-surface-elevated)] px-2 py-0.5 rounded">
              View only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="panel px-2 py-1 flex items-center gap-1 text-xs text-[var(--color-text-dim)]">
            <button onClick={() => zoomBy(0.85)} className="w-6 h-6 hover:text-[var(--color-text)]">−</button>
            <button onClick={resetView} className="px-1 hover:text-[var(--color-text)]">{Math.round(view.scale * 100)}%</button>
            <button onClick={() => zoomBy(1.15)} className="w-6 h-6 hover:text-[var(--color-text)]">+</button>
          </div>

          <button
            onClick={handleShare}
            className="panel px-3 py-2 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          >
            {shareCopied ? 'Link copied ✓' : 'Share'}
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="panel px-3 py-2 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] disabled:opacity-60"
          >
            {exporting ? 'Exporting…' : 'Export PNG'}
          </button>

          <button onClick={openMembers} className="panel px-3 py-2 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            Collaborators
          </button>

          <button
            onClick={() => setShowTutorial(true)}
            title="How to use this board"
            className="panel w-9 h-9 flex items-center justify-center text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          >
            ?
          </button>

          <div className="panel px-3 py-2 flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                saveState === 'error' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-accent)]'
              }`}
            />
            <span className="text-xs text-[var(--color-text-dim)]">{saveLabel}</span>
          </div>
        </div>
      </div>

      {showMembers && (
        <div className="absolute top-16 right-5 panel p-4 w-72 z-40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Collaborators</h3>
            <button onClick={() => setShowMembers(false)} className="text-[var(--color-text-dim)] hover:text-[var(--color-text)]">✕</button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="truncate">{m.displayName}</p>
                  <p className="text-xs text-[var(--color-text-dim)] truncate">{m.email}</p>
                </div>
                {m.role === 'Owner' ? (
                  <span className="text-xs text-[var(--color-text-dim)] shrink-0">Owner</span>
                ) : isOwner ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value as 'Editor' | 'Viewer')}
                    className="text-xs bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-1 py-0.5 shrink-0"
                  >
                    <option value="Editor">Can edit</option>
                    <option value="Viewer">View only</option>
                  </select>
                ) : (
                  <span className="text-xs text-[var(--color-text-dim)] shrink-0">{m.role}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isViewer && (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 panel p-2 flex flex-col gap-1 z-30">
          {tools.map((t) => (
            <button
              key={t.key}
              onClick={() => (t.key === 'image' ? fileInputRef.current?.click() : setActiveTool(t.key))}
              title={`${t.key} (${t.label})`}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors ${
                activeTool === t.key
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
              }`}
            >
              {t.icon}
            </button>
          ))}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />
          <div className="h-px bg-[var(--color-border)] my-1" />
          {STROKE_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} className="w-10 h-10 rounded-lg flex items-center justify-center">
              <span
                className="w-5 h-5 rounded-full block transition-transform"
                style={{
                  background: c,
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                  transform: color === c ? 'scale(1)' : 'scale(0.9)',
                }}
              />
            </button>
          ))}
          <div className="h-px bg-[var(--color-border)] my-1" />
          {(['thin', 'medium', 'thick'] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                width === w ? 'bg-[var(--color-accent-soft)]' : ''
              }`}
            >
              <span
                className="rounded-full bg-[var(--color-text)]"
                style={{ width: STROKE_WIDTHS[w], height: STROKE_WIDTHS[w] }}
              />
            </button>
          ))}
          <div className="h-px bg-[var(--color-border)] my-1" />
          <button
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          >
            ↺
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={(e) => broadcastCursor(e.clientX, e.clientY)}
        className="w-full h-full touch-none"
        style={{
          cursor: isViewer
            ? 'grab'
            : activeTool === 'pen'
              ? 'crosshair'
              : activeTool === 'eraser'
                ? 'cell'
                : activeTool === 'select'
                  ? 'default'
                  : 'copy',
        }}
      />

      <div className="absolute inset-0 z-10" style={{ pointerEvents: 'none' }}>
        {elements
          .filter((e): e is TextEl | StickyEl | ImageEl => e.kind === 'text' || e.kind === 'sticky' || e.kind === 'image')
          .map((el) => {
            const pos = worldToScreen(el.x, el.y)
            if (el.kind === 'image') {
              return (
                <div
                  key={el.id}
                  className="absolute group/img origin-top-left"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: el.width,
                    height: el.height,
                    pointerEvents: 'auto',
                    transform: `scale(${view.scale})`,
                  }}
                  onPointerDown={(e) => handleNoteDragStart(e, el)}
                >
                  <img
                    src={el.src}
                    draggable={false}
                    className="w-full h-full object-contain rounded-md shadow-lg cursor-grab active:cursor-grabbing select-none"
                  />
                  {!isViewer && (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => deleteElementById(el.id)}
                      title="Remove image"
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white text-xs opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            }
            return el.kind === 'sticky' ? (
              <div
                key={el.id}
                className="absolute rounded-md shadow-lg flex flex-col origin-top-left"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: 160,
                  minHeight: 120,
                  background: el.color,
                  pointerEvents: 'auto',
                  transform: `scale(${view.scale})`,
                }}
              >
                <div
                  onPointerDown={(e) => handleNoteDragStart(e, el)}
                  className="h-4 w-full cursor-grab active:cursor-grabbing shrink-0"
                />
                <textarea
                  ref={(node) => { textareaRefs.current[el.id] = node }}
                  value={el.text}
                  disabled={isViewer}
                  onChange={(e) => updateElement(el.id, { text: e.target.value })}
                  placeholder="Type here…"
                  className="flex-1 bg-transparent resize-none outline-none text-sm px-2 pb-2 text-[#1A1610] placeholder:text-[#1A1610]/40"
                />
              </div>
            ) : (
              <div
                key={el.id}
                className="absolute flex items-start gap-1 origin-top-left"
                style={{ left: pos.x, top: pos.y, pointerEvents: 'auto', transform: `scale(${view.scale})` }}
              >
                <div
                  onPointerDown={(e) => handleNoteDragStart(e, el)}
                  className="w-3 h-6 cursor-grab active:cursor-grabbing shrink-0 opacity-0 hover:opacity-40 bg-[var(--color-text)] rounded-sm"
                />
                <textarea
                  ref={(node) => { textareaRefs.current[el.id] = node }}
                  value={el.text}
                  disabled={isViewer}
                  onChange={(e) => updateElement(el.id, { text: e.target.value })}
                  placeholder="Type…"
                  rows={1}
                  className="bg-transparent resize-none outline-none text-lg font-medium leading-snug min-w-[40px]"
                  style={{ color: el.color, width: `${Math.max(4, el.text.length + 2)}ch` }}
                />
              </div>
            )
          })}
      </div>

      <div className="absolute inset-0 pointer-events-none z-20">
        {Object.values(remoteCursors).map((c) => {
          const cColor = cursorColorFor(c.connectionId)
          const pos = worldToScreen(c.x, c.y)
          return (
            <div
              key={c.connectionId}
              className="absolute transition-transform duration-75 ease-linear"
              style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            >
              <div className="w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ background: cColor }} />
              <span
                className="absolute left-2 top-1 text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap text-[#0A1613]"
                style={{ background: cColor }}
              >
                {c.displayName}
              </span>
            </div>
          )
        })}
      </div>

      {showTutorial && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="panel p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Getting around the board</h2>
            <ul className="space-y-3 text-sm text-[var(--color-text-dim)]">
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-mono shrink-0">Scroll</span>
                Move around the board
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-mono shrink-0">Ctrl + Scroll</span>
                Zoom in and out, centered on your cursor
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-mono shrink-0">Space + Drag</span>
                Move around, alternative to scrolling
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-mono shrink-0">Toolbar</span>
                Pen, eraser, sticky notes, and text — pick a tool on the left
              </li>
            </ul>
            <button onClick={() => setShowTutorial(false)} className="btn-primary w-full mt-6">
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
