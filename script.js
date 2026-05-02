import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js"
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js"
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js"

/* ── Firebase config ── */
const firebaseConfig = {
  apiKey: "AIzaSyCx9vhsfwbfEaeJ5hsZNX33I_Duc3Ja8FA",
  authDomain: "water-tracker-2d1dc.firebaseapp.com",
  projectId: "water-tracker-2d1dc",
  storageBucket: "water-tracker-2d1dc.firebasestorage.app",
  messagingSenderId: "997958844208",
  appId: "1:997958844208:web:e014bfa3623c3a96e212f5"
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

/* ── Config ── */
const PRESETS = [150, 250, 350, 500]
const DEFAULT_GOAL = 2000

/* ── State ── */
let entries = []
let goal = DEFAULT_GOAL
let currentUser = null

/* ── Date helpers ── */
const getTodayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getPrevDay = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/* ── Firestore helpers ── */
const loadDay = async (dateStr) => {
  if (!currentUser) return null
  try {
    const ref = doc(db, 'users', currentUser.uid, 'logs', dateStr)
    const snap = await getDoc(ref)
    return snap.exists() ? snap.data() : null
  } catch { return null }
}

const saveDay = async (dateStr, data) => {
  if (!currentUser) return
  try {
    const ref = doc(db, 'users', currentUser.uid, 'logs', dateStr)
    await setDoc(ref, data)
  } catch (e) { console.error('Save error:', e) }
}

const loadGoalFromDB = async () => {
  if (!currentUser) return DEFAULT_GOAL
  try {
    const ref = doc(db, 'users', currentUser.uid, 'settings', 'goal')
    const snap = await getDoc(ref)
    return snap.exists() ? snap.data().value : DEFAULT_GOAL
  } catch { return DEFAULT_GOAL }
}

const saveGoalToDB = async (value) => {
  if (!currentUser) return
  try {
    const ref = doc(db, 'users', currentUser.uid, 'settings', 'goal')
    await setDoc(ref, { value })
  } catch (e) { console.error('Goal save error:', e) }
}

const persistToday = async () => {
  await saveDay(getTodayStr(), { entries, goal })
}

/* ── Streak calculator ── */
const calcStreak = async () => {
  let streak = 0
  let day = getPrevDay(getTodayStr())
  for (let i = 0; i < 30; i++) {
    const data = await loadDay(day)
    if (!data) break
    const tot = (data.entries || []).reduce((s, e) => s + e.amount, 0)
    if (tot >= (data.goal || goal)) {
      streak++
      day = getPrevDay(day)
    } else break
  }
  return streak
}

/* ── Wave SVG ── */
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
const render = async () => {
  const total     = entries.reduce((s, e) => s + e.amount, 0)
  const pct       = Math.min(Math.round((total / goal) * 100), 100)
  const remaining = Math.max(goal - total, 0)
  const reached   = total >= goal

  renderWave(pct)

  const totalEl = document.getElementById('total-display')
  totalEl.innerHTML = `${total}<span>ml</span>`
  totalEl.className = 'total-display' + (reached ? ' reached' : '')

  const msgEl = document.getElementById('goal-msg')
  msgEl.textContent = reached ? 'Goal reached! Great job!' : `${remaining} ml to reach your goal`
  msgEl.className = 'goal-msg' + (reached ? ' reached' : '')

  const bar = document.getElementById('progress-bar')
  bar.style.width = pct + '%'
  bar.className = 'progress-bar' + (reached ? ' reached' : '')

  document.getElementById('pct-label').textContent = pct + '%'
  document.getElementById('goal-edit-btn').textContent = `Goal: ${goal} ml`

  const streak = await calcStreak()
  const badge  = document.getElementById('streak-badge')
  if (streak > 0) {
    badge.style.display = 'block'
    document.getElementById('streak-text').textContent = `${streak} day streak`
  } else {
    badge.style.display = 'none'
  }

  document.getElementById('log-count-label').textContent = `Today's entries (${entries.length})`
  const logList = document.getElementById('log-list')
  if (entries.length === 0) {
    logList.innerHTML = '<div class="empty-msg">No entries yet. Start logging!</div>'
  } else {
    const wrap = document.createElement('div')
    wrap.className = 'log-list'
    ;[...entries].reverse().forEach((entry, ri) => {
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

}

/* ── Calendar state ── */
let calYear  = new Date().getFullYear()
let calMonth = new Date().getMonth()
let rangeStart = null
let rangeEnd   = null

/* ── Calendar helpers ── */
const dateStrFromParts = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const buildCalendar = () => {
  const today    = getTodayStr()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  document.getElementById('cal-month-label').textContent =
    new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const container = document.getElementById('cal-days')
  container.style.display = 'contents'
  container.innerHTML = ''

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div')
    empty.className = 'cal-day cal-day-empty'
    container.appendChild(empty)
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = dateStrFromParts(calYear, calMonth, d)
    const isFuture = dateStr > today
    const isToday  = dateStr === today

    let cls = 'cal-day'
    if (isFuture) cls += ' cal-day-future'
    if (isToday)  cls += ' cal-day-today'
    if (rangeStart && dateStr === rangeStart) cls += ' cal-day-start'
    if (rangeEnd   && dateStr === rangeEnd)   cls += ' cal-day-end'
    if (rangeStart && rangeEnd && dateStr > rangeStart && dateStr < rangeEnd)
      cls += ' cal-day-in-range'

    const btn = document.createElement('button')
    btn.className = cls
    btn.textContent = d
    btn.dataset.date = dateStr
    if (!isFuture) btn.addEventListener('click', () => onDayClick(dateStr))
    container.appendChild(btn)
  }

  updateRangeLabel()
}

const onDayClick = (dateStr) => {
  if (!rangeStart || (rangeStart && rangeEnd)) {
    // Start fresh selection
    rangeStart = dateStr
    rangeEnd   = null
  } else {
    // Second click — set end
    if (dateStr < rangeStart) {
      rangeEnd   = rangeStart
      rangeStart = dateStr
    } else {
      rangeEnd = dateStr
    }
  }
  buildCalendar()
}

const updateRangeLabel = () => {
  const label  = document.getElementById('cal-range-label')
  const btn    = document.getElementById('btn-view-range')
  const fmt    = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (!rangeStart) {
    label.textContent = 'Select a start date'
    btn.style.display = 'none'
  } else if (!rangeEnd) {
    label.textContent = `From: ${fmt(rangeStart)} — select end date`
    btn.style.display = 'none'
  } else {
    label.textContent = `${fmt(rangeStart)} — ${fmt(rangeEnd)}`
    btn.style.display = 'block'
  }
}

window.calPrevMonth = () => {
  calMonth--
  if (calMonth < 0) { calMonth = 11; calYear-- }
  buildCalendar()
}

window.calNextMonth = () => {
  const today = new Date()
  if (calYear === today.getFullYear() && calMonth >= today.getMonth()) return
  calMonth++
  if (calMonth > 11) { calMonth = 0; calYear++ }
  buildCalendar()
}

/* ── View selected range ── */
window.viewRange = async () => {
  if (!rangeStart || !rangeEnd) return
  await renderHistory(rangeStart, rangeEnd)
}

/* ── History renderer ── */
const renderHistory = async (start, end) => {
  const list  = document.getElementById('history-list')
  const today = getTodayStr()

  if (!start || !end) {
    list.innerHTML = '<div class="empty-msg">Pick a date range above to view your history.</div>'
    return
  }

  list.innerHTML = '<div class="empty-msg" style="padding:12px 0">Loading...</div>'

  // Build array of all days in range
  const days = []
  let cur = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  while (cur <= endDate) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }

  let totalOverall = 0
  let daysHit = 0
  const rows = []

  for (const dateStr of days) {
    const data       = await loadDay(dateStr)
    const dayEntries = data ? (data.entries || []) : []
    const dayGoal    = data?.goal || goal
    const dayTotal   = dayEntries.reduce((s, e) => s + e.amount, 0)
    const dayPct     = Math.min(Math.round((dayTotal / dayGoal) * 100), 100)
    const isToday    = dateStr === today
    const isReached  = dayTotal >= dayGoal
    const d          = new Date(dateStr + 'T00:00:00')
    const label      = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    totalOverall += dayTotal
    if (isReached) daysHit++

    rows.push({ label, isToday, isReached, dayTotal, dayGoal, dayPct, dateStr })
  }

  list.innerHTML = ''

  // Summary bar
  const summary = document.createElement('div')
  summary.className = 'history-summary'
  summary.innerHTML = `
    <span class="history-summary-label">${days.length} days &nbsp;·&nbsp; ${daysHit} goals hit</span>
    <span class="history-summary-value">${totalOverall.toLocaleString()} ml total</span>`
  list.appendChild(summary)

  // Individual rows
  for (const r of rows) {
    const row = document.createElement('div')
    row.innerHTML = `
      <div class="history-row-header">
        <span class="history-day ${r.isToday ? 'today' : ''}">
          ${r.label}${r.isToday ? '<span class="history-today-tag">(today)</span>' : ''}
        </span>
        <span class="history-total ${r.isReached ? 'reached' : ''}">
          ${r.dayTotal} / ${r.dayGoal} ml ${r.isReached ? '&#10003;' : ''}
        </span>
      </div>
      <div class="history-bar-wrap">
        <div class="history-bar ${r.isReached ? 'reached' : ''}" style="width:${r.dayPct}%"></div>
      </div>`
    list.appendChild(row)
  }
}


/* ── Add water ── */
const addWater = async (amount) => {
  const entry = {
    id: Date.now(),
    amount,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  entries.push(entry)
  await persistToday()
  render()
}

/* ── Remove entry ── */
window.removeEntry = async (index) => {
  entries.splice(index, 1)
  await persistToday()
  render()
}

/* ── Custom amount ── */
window.handleCustomAdd = async () => {
  const val = parseInt(document.getElementById('custom-input').value)
  if (val > 0 && val <= 5000) {
    await addWater(val)
    document.getElementById('custom-input').value = ''
  }
}

document.getElementById('custom-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') window.handleCustomAdd()
})

/* ── Goal editor ── */
document.getElementById('goal-edit-btn').addEventListener('click', () => {
  document.getElementById('goal-input').value = goal
  document.getElementById('goal-editor').classList.add('visible')
  document.getElementById('goal-input').focus()
})

window.saveGoal = async () => {
  const val = parseInt(document.getElementById('goal-input').value)
  if (val >= 100 && val <= 10000) {
    goal = val
    await saveGoalToDB(goal)
    await persistToday()
    render()
  }
  window.closeGoalEditor()
}

window.closeGoalEditor = () => {
  document.getElementById('goal-editor').classList.remove('visible')
}

document.getElementById('goal-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') window.saveGoal()
})

/* ── Tabs ── */
window.switchTab = (tab) => {
  document.getElementById('panel-today').style.display   = tab === 'today'   ? 'block' : 'none'
  document.getElementById('panel-history').style.display = tab === 'history' ? 'block' : 'none'
  document.getElementById('tab-today').className   = 'tab-btn' + (tab === 'today'   ? ' active' : '')
  document.getElementById('tab-history').className = 'tab-btn' + (tab === 'history' ? ' active' : '')
  if (tab === 'history') {
    buildCalendar()
    renderHistory(null, null)
  }
}

/* ── Build preset buttons ── */
PRESETS.forEach(amount => {
  const btn = document.createElement('button')
  btn.className = 'preset-btn'
  btn.textContent = `${amount} ml`
  btn.addEventListener('click', async () => {
    btn.classList.add('flash')
    setTimeout(() => btn.classList.remove('flash'), 700)
    await addWater(amount)
  })
  document.getElementById('presets-grid').appendChild(btn)
})

/* ── Auth: show/hide forms ── */
window.showAuthTab = (tab) => {
  document.getElementById('form-login').style.display  = tab === 'login'  ? 'block' : 'none'
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'block' : 'none'
  document.getElementById('tab-login').className  = 'auth-tab' + (tab === 'login'  ? ' active' : '')
  document.getElementById('tab-signup').className = 'auth-tab' + (tab === 'signup' ? ' active' : '')
  const el = document.getElementById('auth-error')
  el.textContent = ''
  el.classList.remove('visible')
}

const showAuthError = (msg) => {
  const el = document.getElementById('auth-error')
  el.textContent = msg
  el.classList.add('visible')
}

/* ── Sign up ── */
window.signupUser = async () => {
  const name     = document.getElementById('signup-name').value.trim()
  const email    = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value

  if (!name) return showAuthError('Please enter your name.')
  if (!email) return showAuthError('Please enter your email.')
  if (password.length < 6) return showAuthError('Password must be at least 6 characters.')

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(result.user, { displayName: name })
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') showAuthError('Email already in use.')
    else if (e.code === 'auth/invalid-email') showAuthError('Invalid email address.')
    else showAuthError('Sign up failed. Please try again.')
  }
}

/* ── Login ── */
window.loginUser = async () => {
  const email    = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value

  if (!email || !password) return showAuthError('Please fill in all fields.')

  try {
    await signInWithEmailAndPassword(auth, email, password)
  } catch (e) {
    if (e.code === 'auth/invalid-credential') showAuthError('Wrong email or password.')
    else showAuthError('Login failed. Please try again.')
  }
}

/* ── Logout ── */
window.logoutUser = async () => {
  await signOut(auth)
}

/* ── Auth state listener ── */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user

    // Show app, hide auth
    document.getElementById('auth-screen').style.display = 'none'
    document.getElementById('app-screen').style.display  = 'block'

    // Set user name
    document.getElementById('user-name-label').textContent = user.displayName || user.email

    // Set date label
    document.getElementById('date-label').textContent =
      new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    // Load goal and today's entries
    goal = await loadGoalFromDB()
    const todayData = await loadDay(getTodayStr())
    entries = todayData ? (todayData.entries || []) : []

    render()
  } else {
    currentUser = null
    entries = []
    goal = DEFAULT_GOAL

    // Show auth, hide app
    document.getElementById('auth-screen').style.display = 'flex'
    document.getElementById('app-screen').style.display  = 'none'
  }
})
