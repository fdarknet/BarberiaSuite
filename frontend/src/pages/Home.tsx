import { Link } from "react-router-dom";

export default function Home() {
  return (
    <section className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-5 py-10 text-center">
      <div className="w-full max-w-3xl animate-[homeFadeIn_1.1s_ease-out]">
        <img
          src="/bc-logo.png"
          alt="Logo BC Barber Club Camarguinho"
          className="mx-auto mb-6 w-52 max-w-[70vw] rounded-[2rem] md:w-72"
        />

        <h1 className="text-4xl font-extrabold uppercase tracking-[0.12em] md:text-5xl">
          Bienvenidos
        </h1>
        <p className="mt-3 text-lg font-light text-zinc-300 md:text-xl">
          Tu estilo en manos de expertos.
        </p>

        <Link
          to="/reservar"
          className="mx-auto mt-9 block max-w-md rounded-lg border border-[#d1a751] bg-[#d1a751]/10 px-6 py-7 text-white shadow-[0_10px_30px_rgba(209,167,81,0.16)] transition hover:-translate-y-1 hover:bg-[#d1a751]/20 focus:outline-none focus:ring-2 focus:ring-[#d1a751] focus:ring-offset-2 focus:ring-offset-[#050505]"
        >
          <span className="block text-xl font-bold uppercase tracking-[0.08em] text-[#d1a751]">
            Clic aqui para reservar
          </span>
          <span className="mt-3 block text-base leading-7 text-zinc-100">
            Elige tu horario, servicio y barbero.
            <br />
            <strong>Gracias</strong> por elegirnos.
          </span>
        </Link>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://www.facebook.com/camarguinhobc"
            target="_blank"
            rel="noreferrer"
            className="w-full max-w-xs rounded-full border border-[#d1a751] px-6 py-3 text-white transition hover:bg-[#d1a751] hover:text-[#050505] sm:w-auto"
          >
            Facebook
          </a>
          <a
            href="https://wa.me/59167794793"
            target="_blank"
            rel="noreferrer"
            className="w-full max-w-xs rounded-full border border-[#d1a751] px-6 py-3 text-white transition hover:bg-[#d1a751] hover:text-[#050505] sm:w-auto"
          >
            WhatsApp
          </a>
        </div>

        <footer className="mt-12 text-sm font-bold uppercase tracking-[0.35em] text-[#d1a751]">
          Desde 2014
        </footer>
      </div>
    </section>
  );
}
