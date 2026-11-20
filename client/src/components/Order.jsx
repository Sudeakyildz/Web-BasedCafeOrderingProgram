export default function Order({ orders, onUpdate, onClear, onSubmit }) {
  const totalPrice = Object.entries(orders).reduce(
    (sum, [, { price, quantity }]) => sum + price * quantity,
    0
  )
  const isEmpty = Object.keys(orders).length === 0
  const totalItemCount = Object.values(orders).reduce((sum, item) => sum + item.quantity, 0)

  return (
    <section className="order" id="order-section">
      <div className="order-header">
        <h2>Siparişiniz</h2>
        {!isEmpty && (
          <span className="order-badge">{totalItemCount} ürün</span>
        )}
      </div>

      <ul id="orderList">
        {isEmpty ? (
          <li className="empty-order-msg">Henüz ürün seçmediniz. Menüden ekleme yapabilirsiniz.</li>
        ) : (
          Object.entries(orders).map(([itemName, { price, quantity }]) => (
            <li key={itemName} className="order-list-item">
              <div className="order-item-details">
                <span className="order-item-name">{itemName}</span>
                <span className="order-item-price">{price}₺ x {quantity} = <strong>{price * quantity}₺</strong></span>
              </div>
              <div className="order-item-actions">
                <button 
                  type="button" 
                  className="btn-qty btn-minus" 
                  onClick={() => onUpdate(itemName, -1)}
                  aria-label="Azalt"
                >
                  -
                </button>
                <span className="order-item-qty">{quantity}</span>
                <button 
                  type="button" 
                  className="btn-qty btn-plus" 
                  onClick={() => onUpdate(itemName, 1)}
                  aria-label="Artır"
                >
                  +
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="total">
        <span>Toplam Tutar:</span>
        <span id="totalPrice" className="total-amount">{totalPrice}₺</span>
      </div>

      <div className="order-buttons">
        <button 
          type="button" 
          className="btn-clear" 
          onClick={onClear}
          disabled={isEmpty}
        >
          Temizle
        </button>
        <button 
          type="button" 
          className="btn-submit" 
          onClick={onSubmit}
          disabled={isEmpty}
        >
          Siparişi Tamamla
        </button>
      </div>
    </section>
  )
}
