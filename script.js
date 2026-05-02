/* ── Config ── */
const PRESETS = [150, 250, 350, 500]
const DEFAULT_GOAL = 2000

/* ── State ── */
let entries = []
let goal = DEFAULT_GOAL

/* ── Date helpers ── */
const getTodayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getPrevDay = (dateStr) => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/* ── Storage helpers ── */
const loadDay = (dateStr) => {
  try {
    const raw = localStorage.getItem(`water:${dateStr}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const saveDay = (dateStr, data) => {
  localStorage.setItem(`water:${dateStr}`, JSON.stringify(data))
}

const persistToday = () => {
  saveDay(getTodayStr(), { entries, goal })
}

/* ── Streak calculator ── */
const calcStreak = () => {
  let streak = 0
  let day = getPrevDay(getTodayStr())
  for (let i = 0; i < 365; i++) {
    const data = loadDay(day)
    if (!data) break
    const tot = (data.entries || []).reduce((s, e) => s + e.amount, 0)
    if (tot >= (data.goal || goal)) {
      streak++
      day = getPrevDay(day)
    } else {
      break
    }
  }
  return streak
}

/* ── Wave SVG renderer ── */
const renderWave = (pct) => {
  const reached = pct >= 100
  const y = 100 - Math.min(pct, 100)
  const fill = reached ? '#22c55e' : '#3b82f6'
  const bg   = reached ? '#bbf7d0' : '#bfdbfe'

  document.getElementById('wave-bg').setAttribute('fill', bg)
  document.getElementById('wave-back').setAttribute('fill', fill)
  document.getElementById('wave-back').setAttribute('d',
    `M0,${y} Q25,${y - 6} 50,${y} Q75,${y + 6} 100,${y} L100,100 L0,100 Z`)
  document.getElementById('wave-front').setAttribute('fill', fill)
  document.getElementById('wave-front').setAttribute('d',
    `M0,${y + 3} Q25,${y - 3} 50,${y + 3} Q75,${y + 9} 100,${y + 3} L100,100 L0,100 Z`)
}

/* ── Main render ── */
const render = () => {
  const total     = entries.reduce((s, e) => s + e.amount, 0)
  const pct       = Math.min(Math.round((total / goal) * 100), 100)
  const remaining = Math.max(goal - total, 0)
  const reached   = total >= goal

  // Wave
  renderWave(pct)

  // Total amount display
  const totalEl = document.getElementById('total-display')
  totalEl.innerHTML = `${total}<span>ml</span>`
  totalEl.className = 'total-display' + (reached ? ' reached' : '')

  // Goal message
  const msgEl = document.getElementById('goal-msg')
  msgEl.textContent = reached ? '🎉 Goal reached! Great job!' : `${remaining} ml to reach your goal`
  msgEl.className = 'goal-msg' + (reached ? ' reached' : '')

  // Progress bar
  const bar = document.getElementById('progress-bar')
  bar.style.width = pct + '%'
  bar.className = 'progress-bar' + (reached ? ' reached' : '')

  // Percentage label & goal button
  document.getElementById('pct-label').textContent = pct + '%'
  document.getElementById('goal-edit-btn').textContent = `Goal: ${goal} ml`

  // Streak badge
  const streak = calcStreak()
  const badge  = document.getElementById('streak-badge')
  if (streak > 0) {
    badge.style.display = 'block'
    document.getElementById('streak-text').textContent = `${streak} day streak`
  } else {
    badge.style.display = 'none'
  }

  // Today's log
  document.getElementById('log-count-label').textContent = `Today's entries (${entries.length})`
  const logList = document.getElementById('log-list')
  if (entries.length === 0) {
    logList.innerHTML = '<div class="empty-msg">No entries yet. Start logging! 💧</div>'
  } else {
    const wrap = document.createElement('div')
    wrap.className = 'log-list';
    [...entries].reverse().forEach((entry, ri) => {
      const realIndex = entries.length - 1 - ri
      const row = document.createElement('div')
      row.className = 'log-entry'
      row.innerHTML = `
        <div class="log-entry-left">
          <div class="log-dot"></div>
          <span class="log-amount">${entry.amount} ml</span>
        </div>
        <div class="log-entry-right">
          <span class="log-time">${entry.time}</span>
          <button class="log-remove" onclick="removeEntry(${realIndex})">✕</button>
        </div>`
      wrap.appendChild(row)
    })
    logList.innerHTML = ''
    logList.appendChild(wrap)
  }

  // History
  renderHistory()
}

/* ── History renderer ── */
const renderHistory = () => {
  const list  = document.getElementById('history-list')
  const today = getTodayStr()
  list.innerHTML = ''

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().slice(0, 10)
  }).reverse()

  days.forEach(dateStr => {
    const data       = loadDay(dateStr)
    const dayEntries = data ? (data.entries || []) : []
    const dayGoal    = data?.goal || goal
    const dayTotal   = dayEntries.reduce((s, e) => s + e.amount, 0)
    const dayPct     = Math.min(Math.round((dayTotal / dayGoal) * 100), 100)
    const isToday    = dateStr === today
    const isReached  = dayTotal >= dayGoal

    const d     = new Date(dateStr + 'T00:00:00')
    const label = isToday
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    const row = document.createElement('div')
    row.innerHTML = `
      <div class="history-row-header">
        <span class="history-day ${isToday ? 'today' : ''}">
          ${label}${isToday ? '<span class="history-today-tag">(today)</span>' : ''}
        </span>
        <span class="history-total ${isReached ? 'reached' : ''}">
          ${dayTotal} / ${dayGoal} ml ${isReached ? '✓' : ''}
        </span>
      </div>
      <div class="history-bar-wrap">
        <div class="history-bar ${isReached ? 'reached' : ''}" style="width:${dayPct}%"></div>
      </div>`
    list.appendChild(row)
  })
}

/* ── Add water ── */
const addWater = (amount) => {
  const entry = {
    id: Date.now(),
    amount,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  entries.push(entry)
  persistToday()
  render()
}

/* ── Remove entry ── */
const removeEntry = (index) => {
  entries.splice(index, 1)
  persistToday()
  render()
}

/* ── Custom amount ── */
const handleCustomAdd = () => {
  const val = parseInt(document.getElementById('custom-input').value)
  if (val > 0 && val <= 5000) {
    addWater(val)
    document.getElementById('custom-input').value = ''
  }
}

document.getElementById('custom-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleCustomAdd()
})

/* ── Goal editor ── */
document.getElementById('goal-edit-btn').addEventListener('click', () => {
  document.getElementById('goal-input').value = goal
  document.getElementById('goal-editor').classList.add('visible')
  document.getElementById('goal-input').focus()
})

const saveGoal = () => {
  const val = parseInt(document.getElementById('goal-input').value)
  if (val >= 100 && val <= 10000) {
    goal = val
    localStorage.setItem('water:goal', String(goal))
    persistToday()
    render()
  }
  closeGoalEditor()
}

const closeGoalEditor = () => {
  document.getElementById('goal-editor').classList.remove('visible')
}

document.getElementById('goal-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveGoal()
})

/* ── Tabs ── */
const switchTab = (tab) => {
  document.getElementById('panel-today').style.display   = tab === 'today'   ? 'block' : 'none'
  document.getElementById('panel-history').style.display = tab === 'history' ? 'block' : 'none'
  document.getElementById('tab-today').className   = 'tab-btn' + (tab === 'today'   ? ' active' : '')
  document.getElementById('tab-history').className = 'tab-btn' + (tab === 'history' ? ' active' : '')
}

/* ── Build preset buttons ── */
PRESETS.forEach(amount => {
  const btn = document.createElement('button')
  btn.className = 'preset-btn'
  btn.textContent = `${amount} ml`
  btn.addEventListener('click', () => {
    btn.classList.add('flash')
    setTimeout(() => btn.classList.remove('flash'), 700)
    addWater(amount)
  })
  document.getElementById('presets-grid').appendChild(btn)
})

/* ── Set date label ── */
document.getElementById('date-label').textContent =
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

/* ── Init: load saved data ── */
const savedGoal = localStorage.getItem('water:goal')
if (savedGoal) goal = parseInt(savedGoal)

const todayData = loadDay(getTodayStr())
if (todayData) entries = todayData.entries || []

render()
