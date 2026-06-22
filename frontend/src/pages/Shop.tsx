import { useEffect, useMemo, useState } from "react";
import { api, assetUrl } from "../api";

const ORG_ID = import.meta.env.VITE_ORG_ID as string;
const DEFAULT_WHATSAPP = "59167794793";

function onlyDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export default function Shop() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState(DEFAULT_WHATSAPP);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [storeEnabled, setStoreEnabled] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ORG_ID) return;
    Promise.all([api.publicProducts(ORG_ID), api.orgPublic(ORG_ID).catch(() => null)])
      .then(([productResponse, orgResponse]) => {
        setProducts(productResponse.products ?? []);
        setStoreEnabled(Boolean(orgResponse?.org?.store?.enabled ?? productResponse.storeEnabled ?? true));
        setPaymentQrUrl(orgResponse?.org?.paymentQrUrl ?? null);
        const configuredNumber = onlyDigits(orgResponse?.org?.whatsappDisplayNumber);
        if (configuredNumber) setWhatsappNumber(configuredNumber);
      })
      .finally(() => setLoading(false));
  }, []);

  const cartRows = useMemo(() => products
    .filter((product) => (cart[product.id] ?? 0) > 0)
    .map((product) => ({ product, quantity: cart[product.id], subtotal: product.price * cart[product.id] })), [cart, products]);
  const total = cartRows.reduce((sum, row) => sum + row.subtotal, 0);

  function changeQuantity(productId: string, delta: number) {
    setOrder(null);
    setCart((current) => {
      const quantity = Math.max(0, (current[productId] ?? 0) + delta);
      const next = { ...current };
      if (quantity === 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  async function confirmOrder() {
    if (submitting || cartRows.length === 0) return;
    if (customerName.trim().length < 2 || onlyDigits(customerPhone).length < 7) {
      setError("Ingresa tu nombre y un telefono valido.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.createStoreOrder(ORG_ID, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: notes.trim() || undefined,
        items: cartRows.map((row) => ({ productId: row.product.id, quantity: row.quantity })),
      });
      setOrder(response.order);
      setPaymentQrUrl(response.paymentQrUrl ?? paymentQrUrl);
      setCart({});
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setSubmitting(false);
    }
  }

  const orderReference = order ? order.id.slice(-8).toUpperCase() : "";
  const receiptMessage = order
    ? `Hola, envio el comprobante del pedido #${orderReference} por Bs ${order.amountTotal}. Cliente: ${order.customerName}`
    : "";

  return (
    <div className="space-y-6">
      <header className="border-b border-[#d1a751]/40 pb-5">
        <h1 className="text-2xl font-extrabold">Tienda Online</h1>
        <p className="mt-1 text-sm text-slate-600">Elige tus productos y paga mediante QR.</p>
      </header>

      {loading ? (
        <div className="text-sm text-slate-600">Cargando productos...</div>
      ) : !storeEnabled ? (
        <div className="border p-6 text-sm text-slate-600">La tienda online no esta disponible por el momento.</div>
      ) : products.length === 0 ? (
        <div className="border p-6 text-sm text-slate-600">No hay productos disponibles.</div>
      ) : (
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const quantity = cart[product.id] ?? 0;
              return (
                <article key={product.id} className="border bg-white p-4 shadow-sm">
                  <div className="aspect-square overflow-hidden bg-slate-100">
                    {product.imageUrl ? (
                      <img src={assetUrl(product.imageUrl)} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl font-extrabold text-slate-500">{String(product.name ?? "?").slice(0, 1)}</div>
                    )}
                  </div>
                  <div className="mt-3 text-xs font-mono text-slate-500">{product.code}</div>
                  <h2 className="mt-1 text-lg font-bold">{product.name}</h2>
                  <div className="mt-2 text-xl font-extrabold text-[#a77b17]">Bs {product.price}</div>
                  <div className="mt-4 flex h-11 items-center justify-between border">
                    <button type="button" className="h-full w-12 text-xl font-bold" aria-label={`Quitar ${product.name}`} onClick={() => changeQuantity(product.id, -1)} disabled={quantity === 0}>−</button>
                    <span className="min-w-10 text-center font-bold">{quantity}</span>
                    <button type="button" className="h-full w-12 text-xl font-bold" aria-label={`Agregar ${product.name}`} onClick={() => changeQuantity(product.id, 1)}>+</button>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="h-fit border bg-white p-5 shadow-sm lg:sticky lg:top-5">
            {order ? (
              <div>
                <div className="text-xs font-bold uppercase text-emerald-700">Pedido registrado</div>
                <h2 className="mt-1 text-xl font-extrabold">Pedido #{orderReference}</h2>
                <p className="mt-2 text-sm text-slate-600">Escanea el QR, paga <b>Bs {order.amountTotal}</b> y envia el comprobante.</p>
                {paymentQrUrl ? <img src={assetUrl(paymentQrUrl)} alt="QR de pago" className="mx-auto mt-4 max-h-[520px] w-full object-contain" /> : <div className="mt-4 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">El QR de pago aun no fue configurado.</div>}
                <a href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(receiptMessage)}`} target="_blank" rel="noreferrer" className="mt-4 block bg-[#1f7a4d] px-4 py-3 text-center font-bold text-white">Enviar comprobante</a>
                <button type="button" className="mt-2 w-full border px-4 py-3 font-bold" onClick={() => setOrder(null)}>Crear otro pedido</button>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-extrabold">Tu pedido</h2>
                <div className="mt-3 space-y-2 border-b pb-3">
                  {cartRows.map((row) => <div key={row.product.id} className="flex justify-between gap-3 text-sm"><span>{row.quantity} x {row.product.name}</span><b>Bs {row.subtotal}</b></div>)}
                  {cartRows.length === 0 && <p className="text-sm text-slate-500">Agrega productos para continuar.</p>}
                </div>
                <div className="mt-3 flex justify-between text-lg font-extrabold"><span>Total</span><span>Bs {total}</span></div>
                <div className="mt-5 space-y-3">
                  <input className="w-full border p-3" placeholder="Nombre completo" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  <input className="w-full border p-3" type="tel" placeholder="Telefono / WhatsApp" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  <textarea className="min-h-20 w-full border p-3" placeholder="Nota para el pedido (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {error && <div className="mt-3 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
                <button type="button" disabled={submitting || cartRows.length === 0} className="mt-4 w-full bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-40" onClick={confirmOrder}>{submitting ? "Confirmando..." : `Confirmar pedido - Bs ${total}`}</button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
