import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import Header from './components/Header'
import Menu from './components/Menu'
import Order from './components/Order'
import Footer from './components/Footer'
import './App.css'

function tableFromUrl() {
  const m = new URLSearchParams(window.location.search).get('masa')
  return m && /^\d{1,3}$/.test(m) ? m : ''
}

export default function App() {
  const [menu, setMenu] = useState([])
  const [menuError, setMenuError] = useState(false)
  // orders: { [itemId]: quantity }
  const [orders, setOrders] = useState({})
  const [tableNo, setTableNo] = useState(tableFromUrl)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notification, setNotification] = useState(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    fetch('/api/menu')
      .then((res) => {
        if (!res.ok) throw new Error('menu')
        return res.json()
      })
      .then(setMenu)
      .catch(() => setMenuError(true))
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current)
    setNotification({ message, type })
    toastTimer.current = setTimeout(() => setNotification(null), 3500)
  }, [])

  const itemsById = useMemo(() => {
    const map = {}
    for (const cat of menu) for (const item of cat.items) map[item.id] = item
    return map
  }, [menu])

  // Sepet satırları: fiyat bilgisi menüden okunur
  const lines = useMemo(
    () =>
      Object.entries(orders)
        .filter(([id]) => itemsById[id])
        .map(([id, quantity]) => ({ ...itemsById[id], quantity })),
    [orders, itemsById]
  )

  const addToOrder = useCallback((id) => {
    setOrders((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }))
  }, [])

  const updateOrder = useCallback((id, change) => {
    setOrders((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      const qty = prev[id] + change
      if (qty <= 0) delete next[id]
      else next[id] = Math.min(qty, 50)
      return next
    })
  }, [])

  const clearOrder = useCallback(() => setOrders({}), [])

  const totalItemCount = lines.reduce((sum, l) => sum + l.quantity, 0)
  const totalAmount = lines.reduce((sum, l) => sum + l.price * l.quantity, 0)

  const submitOrder = useCallback(async () => {
    if (lines.length === 0) {
      showToast('Sipariş vermek için önce ürün ekleyin.', 'warning')
      return
    }
    const table = Number(tableNo)
    if (!Number.isInteger(table) || table < 1 || table > 999) {
      showToast('Lütfen geçerli bir masa numarası girin.', 'warning')
      return
    }
    if (!paymentMethod) {
      showToast('Lütfen bir ödeme yöntemi seçin.', 'warning')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNo: table,
          paymentMethod,
          items: lines.map((l) => ({ id: l.id, quantity: l.quantity })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Sipariş gönderilemedi.')
      showToast(data.message || 'Siparişiniz alındı! Afiyet olsun.', 'success')
      clearOrder()
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Sipariş gönderilirken bir hata oluştu.', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [lines, tableNo, paymentMethod, showToast, clearOrder])

  const scrollToOrder = () => {
    const el = document.getElementById('order-section')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <Header />

      {notification && (
        <div className={`toast-notification toast-${notification.type}`} role="status">
          {notification.message}
        </div>
      )}

      <main className="main-content">
        <Menu menu={menu} error={menuError} onAddToOrder={addToOrder} />
        <Order
          lines={lines}
          tableNo={tableNo}
          onTableChange={setTableNo}
          paymentMethod={paymentMethod}
          onPaymentChange={setPaymentMethod}
          submitting={submitting}
          onUpdate={updateOrder}
          onClear={clearOrder}
          onSubmit={submitOrder}
        />
      </main>

      {totalItemCount > 0 && (
        <button type="button" className="mobile-cart-bar" onClick={scrollToOrder}>
          <span className="mobile-cart-info">
            <span className="mobile-cart-count">{totalItemCount} Ürün</span>
            <span className="mobile-cart-total">{totalAmount}₺</span>
          </span>
          <span className="mobile-cart-btn">Sepete Git →</span>
        </button>
      )}

      <Footer />
    </>
  )
}
