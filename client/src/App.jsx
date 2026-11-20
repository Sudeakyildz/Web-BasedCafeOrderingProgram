import { useState, useCallback } from 'react'
import Header from './components/Header'
import Menu from './components/Menu'
import Order from './components/Order'
import Footer from './components/Footer'
import './App.css'

export default function App() {
  const [orders, setOrders] = useState({})
  const [notification, setNotification] = useState(null)

  const showToast = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3500)
  }

  const addToOrder = useCallback((itemName, price) => {
    setOrders((prev) => {
      const next = { ...prev }
      if (next[itemName]) {
        next[itemName].quantity += 1
      } else {
        next[itemName] = { price, quantity: 1 }
      }
      return next
    })
  }, [])

  const updateOrder = useCallback((itemName, change) => {
    setOrders((prev) => {
      const next = { ...prev }
      if (!next[itemName]) return next
      next[itemName].quantity += change
      if (next[itemName].quantity <= 0) delete next[itemName]
      return next
    })
  }, [])

  const clearOrder = useCallback(() => setOrders({}), [])

  const submitOrder = useCallback(async () => {
    if (Object.keys(orders).length === 0) {
      showToast('Sipariş vermek için önce ürün ekleyin.', 'warning')
      return
    }
    const orderData = {
      orderItems: Object.entries(orders).map(([itemName, { price, quantity }]) => ({
        itemName,
        quantity,
        totalPrice: price * quantity,
      })),
      totalAmount: Object.values(orders).reduce(
        (sum, { price, quantity }) => sum + price * quantity,
        0
      ),
    }
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      showToast(data.message || 'Siparişiniz başarıyla alındı! Afiyet olsun.', 'success')
      clearOrder()
    } catch (err) {
      console.error(err)
      showToast('Sipariş gönderilirken bir hata oluştu.', 'error')
    }
  }, [orders, clearOrder])

  const totalItemCount = Object.values(orders).reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = Object.values(orders).reduce((sum, item) => sum + item.price * item.quantity, 0)

  const scrollToOrder = () => {
    const el = document.getElementById('order-section')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      <Header />
      
      {notification && (
        <div className={`toast-notification toast-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <main className="main-content">
        <Menu onAddToOrder={addToOrder} />
        <Order
          orders={orders}
          onUpdate={updateOrder}
          onClear={clearOrder}
          onSubmit={submitOrder}
        />
      </main>

      {totalItemCount > 0 && (
        <div className="mobile-cart-bar" onClick={scrollToOrder}>
          <div className="mobile-cart-info">
            <span className="mobile-cart-count">{totalItemCount} Ürün</span>
            <span className="mobile-cart-total">{totalAmount}₺</span>
          </div>
          <span className="mobile-cart-btn">Sepete Git →</span>
        </div>
      )}

      <Footer />
    </>
  )
}
