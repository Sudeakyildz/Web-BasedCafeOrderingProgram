export default function MenuItem({ item, onAdd }) {
  return (
    <div className="menu-item">
      <img src={item.image} alt={item.name} loading="lazy" />
      <div className="menu-item-info">
        <p className="menu-item-name">{item.name}</p>
        <span className="menu-item-price">{item.price}₺</span>
      </div>
      <button 
        type="button" 
        className="btn-add" 
        onClick={() => onAdd(item.id)}
      >
        + Ekle
      </button>
    </div>
  )
}
