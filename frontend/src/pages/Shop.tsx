import { useEffect, useState } from "react";
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
  const [storeEnabled, setStoreEnabled] = useState(true);

  useEffect(() => {
    if (!ORG_ID) return;
    Promise.all([
      api.publicProducts(ORG_ID),
      api.orgPublic(ORG_ID).catch(() => null),
    ])
      .then(([productResponse, orgResponse]) => {
        setProducts(productResponse.products ?? []);
        setStoreEnabled(Boolean(orgResponse?.org?.store?.enabled ?? productResponse.storeEnabled ?? true));
        const configuredNumber = onlyDigits(orgResponse?.org?.whatsappDisplayNumber);
        if (configuredNumber) setWhatsappNumber(configuredNumber);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold">Tienda Online</h1>
        <p className="mt-1 text-sm text-slate-600">Productos disponibles en Camarguinho Barber Club.</p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-600">Cargando productos...</div>
      ) : !storeEnabled ? (
        <div className="bg-white border rounded-2xl p-6 text-sm text-slate-600">La tienda online no esta disponible por el momento.</div>
      ) : products.length === 0 ? (
        <div className="bg-white border rounded-2xl p-6 text-sm text-slate-600">No hay productos disponibles.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="aspect-square overflow-hidden rounded-xl bg-slate-100">
                {product.imageUrl ? (
                  <img src={assetUrl(product.imageUrl)} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-extrabold text-slate-500">
                    {String(product.name ?? "?").slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <div className="text-xs font-mono text-slate-500">{product.code}</div>
                <h2 className="mt-1 text-lg font-bold">{product.name}</h2>
                <div className="mt-2 text-2xl font-extrabold text-[#f2cf5b]">Bs {product.price}</div>
              </div>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hola, quiero consultar por el producto ${product.name} (${product.code})`)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block rounded-xl bg-slate-900 px-4 py-3 text-center font-bold text-white"
              >
                Consultar por WhatsApp
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
