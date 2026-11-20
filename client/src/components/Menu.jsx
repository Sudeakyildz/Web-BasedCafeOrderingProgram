import MenuItem from './MenuItem'

export default function Menu({ menu, error, onAddToOrder }) {
  return (
    <section className="menu">
      <h2>Menü</h2>
      {error && <p className="empty-order-msg">Menü yüklenemedi. Sayfayı yenileyin.</p>}
      {!error && menu.length === 0 && <p className="empty-order-msg">Menü yükleniyor…</p>}
      {menu.map((category) => (
        <div key={category.id} className="menu-category">
          <h3>{category.name}</h3>
          {category.items.map((item) => (
            <MenuItem key={item.id} item={item} onAdd={onAddToOrder} />
          ))}
        </div>
      ))}
    </section>
  )
}
