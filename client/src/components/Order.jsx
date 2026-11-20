export default function Order({
  lines,
  tableNo,
  onTableChange,
  submitting,
  onUpdate,
  onClear,
  onSubmit,
}) {
  const totalPrice = lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
  const isEmpty = lines.length === 0
  const totalItemCount = lines.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <section className="order" id="order-section">
      <div className="order-header">
        <h2>Siparişiniz</h2>
        {!isEmpty && <span className="order-badge">{totalItemCount} ürün</span>}
      </div>

      <label className="table-field">
        Masa No:
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max="999"
          value={tableNo}
          onChange={(e) => onTableChange(e.target.value)}
          placeholder="Örn. 5"
        />
      </label>

      <ul id="orderList">
        {isEmpty ? (
          <li className="empty-order-msg">Henüz ürün seçmediniz. Menüden ekleme yapabilirsiniz.</li>
        ) : (
          lines.map(({ id, name, price, quantity }) => (
            <li key={id} className="order-list-item">
              <div className="order-item-details">
                <span className="order-item-name">{name}</span>
                <span className="order-item-price">
                  {price}₺ x {quantity} = <strong>{price * quantity}₺</strong>
                </span>
              </div>
              <div className="order-item-actions">
                <button
                  type="button"
                  className="btn-qty btn-minus"
                  onClick={() => onUpdate(id, -1)}
                  aria-label="Azalt"
                >
                  -
                </button>
                <span className="order-item-qty">{quantity}</span>
                <button
                  type="button"
                  className="btn-qty btn-plus"
                  onClick={() => onUpdate(id, 1)}
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
        <button type="button" className="btn-clear" onClick={onClear} disabled={isEmpty || submitting}>
          Temizle
        </button>
        <button type="button" className="btn-submit" onClick={onSubmit} disabled={isEmpty || submitting}>
          {submitting ? 'Gönderiliyor…' : 'Siparişi Tamamla'}
        </button>
      </div>
    </section>
  )
}
